-- Owner-made subscription cards ("Abbonamenti" for the whole chain).
--
-- Until now every Manager built their own catalog (`site_plan_cards`). Now the Owner defines the
-- catalog once — a free-text name, monthly or annual, created date — and every Manager in the
-- Owner's chain sees the same cards and assigns them to Clients. Confirmed product decisions:
--   * Only the Owner creates/edits/deactivates/deletes these cards; Managers only see and assign
--     them. The Owner can optionally let Managers also create their own cards
--     (`gym_chains.managers_can_create_cards`, off by default).
--   * Every card a Manager had made before this migration is deactivated immediately (existing
--     subscriptions keep their already-snapshotted terms and their `card_id` link; new Clients are
--     only offered the Owner's cards).
--   * No price is required — an Owner card carries only name + monthly/annual + created date, so
--     `site_plan_cards.price_eur` becomes nullable.
--
-- Mechanism: `owner_plan_cards` is the Owner's master list (per chain). Each master card is mirrored
-- as one real `site_plan_cards` row per site in the chain (`owner_card_id` points back). That keeps
-- every existing client/manager RPC (`client_choose_plan`, `manager_assign_plan`, the live
-- propagation to subscriptions, …) working untouched, since they all already read `site_plan_cards`.

alter table public.gym_chains add column managers_can_create_cards boolean not null default false;

alter table public.site_plan_cards alter column price_eur drop not null;
alter table public.site_plan_cards add column owner_card_id uuid;

create table public.owner_plan_cards (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.gym_chains(id),
  name text not null,
  kind text not null check (kind in ('monthly', 'annual')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index owner_plan_cards_chain_id_idx on public.owner_plan_cards(chain_id);

alter table public.site_plan_cards
  add constraint site_plan_cards_owner_card_id_fkey foreign key (owner_card_id) references public.owner_plan_cards(id);
create index site_plan_cards_owner_card_id_idx on public.site_plan_cards(owner_card_id);

alter table public.owner_plan_cards enable row level security;

create policy "owner_plan_cards_select_by_owner" on public.owner_plan_cards
  for select to authenticated
  using (public.is_owner() and chain_id = public.owner_chain_id());

-- Writes only through the SECURITY DEFINER RPCs below, same convention as every other table here.
revoke insert, update, delete on public.owner_plan_cards from authenticated, anon;

-- Monthly = 30 days, annual = 365 — the same two durations the app has always meant by them.
create function public.plan_kind_days(p_kind text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_kind when 'annual' then 365 else 30 end;
$$;

-- ── Guard: Managers can't touch Owner-made cards, and can only create their own when the Owner allows
-- it. A trigger (not a rewrite of the manager_* RPCs) so it holds no matter which RPC/policy path is
-- used. `auth.uid()` is the real caller even inside SECURITY DEFINER functions; it is null for cron /
-- service work, which is never blocked.
create function public.site_plan_cards_manager_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_chain uuid;
  v_allowed boolean;
begin
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager') into v_is_manager;
  if not v_is_manager then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_card_id is null then
      select chain_id into v_chain from public.sites where site_id = new.site_id;
      if v_chain is not null then
        select managers_can_create_cards into v_allowed from public.gym_chains where id = v_chain;
        if not coalesce(v_allowed, false) then
          raise exception 'only the owner can create subscription cards';
        end if;
      end if;
    end if;
    return new;
  end if;

  if old.owner_card_id is not null then
    raise exception 'this card is managed by the owner';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger site_plan_cards_manager_guard
  before insert or update or delete on public.site_plan_cards
  for each row execute function public.site_plan_cards_manager_guard();

-- ── owner_create_plan_card() — one master card + a mirror row on every site in the chain ───────────
create function public.owner_create_plan_card(p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
  v_id uuid;
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_kind not in ('monthly', 'annual') then
    raise exception 'invalid kind';
  end if;

  insert into public.owner_plan_cards (chain_id, name, kind) values (v_chain, v_name, p_kind) returning id into v_id;

  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, owner_card_id)
  select s.site_id, v_name, null, public.plan_kind_days(p_kind), v_id
  from public.sites s
  where s.chain_id = v_chain;

  return v_id;
end;
$$;

revoke all on function public.owner_create_plan_card(text, text) from public;
grant execute on function public.owner_create_plan_card(text, text) to authenticated;

-- ── owner_update_plan_card() — edits the master, every mirror, and every live subscription on them ──
create function public.owner_update_plan_card(p_card_id uuid, p_name text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
  v_days int := public.plan_kind_days(p_kind);
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_kind not in ('monthly', 'annual') then
    raise exception 'invalid kind';
  end if;

  update public.owner_plan_cards set name = v_name, kind = p_kind where id = p_card_id and chain_id = v_chain;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.site_plan_cards set name = v_name, duration_days = v_days where owner_card_id = p_card_id;

  update public.subscriptions
  set plan_name = v_name, duration_days = v_days, expiry_date = start_date + v_days, updated_at = now()
  where card_id in (select id from public.site_plan_cards where owner_card_id = p_card_id);
end;
$$;

revoke all on function public.owner_update_plan_card(uuid, text, text) from public;
grant execute on function public.owner_update_plan_card(uuid, text, text) to authenticated;

-- ── owner_set_plan_card_active() — retire/re-offer a card for new signups on every site ───────────
create function public.owner_set_plan_card_active(p_card_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;

  update public.owner_plan_cards set active = p_active where id = p_card_id and chain_id = v_chain;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.site_plan_cards set active = p_active where owner_card_id = p_card_id;
end;
$$;

revoke all on function public.owner_set_plan_card_active(uuid, boolean) from public;
grant execute on function public.owner_set_plan_card_active(uuid, boolean) to authenticated;

-- ── owner_delete_plan_card() — real delete; subscribers are detached (keep their snapshotted terms) ─
create function public.owner_delete_plan_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  if not exists (select 1 from public.owner_plan_cards where id = p_card_id and chain_id = v_chain) then
    raise exception 'not authorized';
  end if;

  update public.subscriptions set card_id = null
  where card_id in (select id from public.site_plan_cards where owner_card_id = p_card_id);
  delete from public.site_plan_cards where owner_card_id = p_card_id;
  delete from public.owner_plan_cards where id = p_card_id and chain_id = v_chain;
end;
$$;

revoke all on function public.owner_delete_plan_card(uuid) from public;
grant execute on function public.owner_delete_plan_card(uuid) to authenticated;

-- ── owner_set_managers_can_create_cards() — the option: may Managers also make their own cards? ───
create function public.owner_set_managers_can_create_cards(p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  update public.gym_chains set managers_can_create_cards = p_allowed where id = v_chain;
end;
$$;

revoke all on function public.owner_set_managers_can_create_cards(boolean) from public;
grant execute on function public.owner_set_managers_can_create_cards(boolean) to authenticated;

-- The setting itself, readable by the Owner (it already can see its own chain row through
-- `owner_get_chain`-style RPCs; a tiny dedicated read avoids touching those) and by the chain's
-- Managers (the Manager screen needs it to decide whether to show "crea carta").
create function public.get_managers_can_create_cards()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select c.managers_can_create_cards
     from public.gym_chains c
     where c.id = coalesce(
       public.owner_chain_id(),
       (select s.chain_id from public.profiles p join public.sites s on s.site_id = p.site_id where p.id = auth.uid())
     )),
    true  -- a Manager whose gym belongs to no chain has no Owner above them: no restriction.
  );
$$;

revoke all on function public.get_managers_can_create_cards() from public;
grant execute on function public.get_managers_can_create_cards() to authenticated;

-- ── A site that joins (or is moved into) a chain gets the chain's active Owner cards mirrored ──────
create function public.sites_mirror_owner_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chain_id is null then
    return new;
  end if;
  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, owner_card_id, active)
  select new.site_id, o.name, null, public.plan_kind_days(o.kind), o.id, o.active
  from public.owner_plan_cards o
  where o.chain_id = new.chain_id
    and not exists (select 1 from public.site_plan_cards c where c.site_id = new.site_id and c.owner_card_id = o.id);
  return new;
end;
$$;

create trigger sites_mirror_owner_cards
  after insert or update of chain_id on public.sites
  for each row execute function public.sites_mirror_owner_cards();

-- ── Replace the Managers' own existing cards right away (kept for current subscribers, not offered) ─
-- Only chain sites are affected: a site with no Owner above it keeps managing its own catalog.
update public.site_plan_cards c
set active = false
where c.owner_card_id is null
  and c.site_id in (select site_id from public.sites where chain_id is not null);

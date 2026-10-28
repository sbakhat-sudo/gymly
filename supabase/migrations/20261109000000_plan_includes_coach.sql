-- A subscription may or may not include the coach. Only a Client whose current plan includes the coach can rate
-- the coach (feedback); every Client can still send a report ("segnalazione") after check-out.
--
-- Who decides: whoever makes the card — the Owner for the Owner's cards (the flag is copied to every gym of the
-- chain, Managers cannot change it), the Manager for a card of their own. Cards that exist already start as
-- "no coach", so nobody can rate a coach until the card says so.
--
-- Nothing is copied into `subscriptions`: the rule reads the flag from the Client's card at the moment of rating,
-- so changing a card takes effect for everyone on it at once.

alter table public.owner_plan_cards add column includes_coach boolean not null default false;
alter table public.site_plan_cards add column includes_coach boolean not null default false;

-- New gyms of a chain get the Owner's cards with their coach flag.
create or replace function public.sites_mirror_owner_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chain_id is null then
    return new;
  end if;
  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, description, color, owner_card_id, active, includes_coach)
  select new.site_id, o.name, o.price_eur, public.plan_kind_days(o.kind), o.description, o.color, o.id, o.active, o.includes_coach
  from public.owner_plan_cards o
  where o.chain_id = new.chain_id
    and not exists (select 1 from public.site_plan_cards c where c.site_id = new.site_id and c.owner_card_id = o.id);
  return new;
end;
$$;

-- The Owner sets it on one of their cards: the card itself and its copy in every gym of the chain.
create function public.owner_set_plan_card_coach(p_card_id uuid, p_includes boolean)
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

  update public.owner_plan_cards set includes_coach = coalesce(p_includes, false) where id = p_card_id and chain_id = v_chain;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.site_plan_cards set includes_coach = coalesce(p_includes, false) where owner_card_id = p_card_id;
end;
$$;

revoke all on function public.owner_set_plan_card_coach(uuid, boolean) from public, anon;
grant execute on function public.owner_set_plan_card_coach(uuid, boolean) to authenticated;

-- A Manager sets it on a card of their own gym — never on one the Owner made (those stay the Owner's).
create function public.manager_set_plan_card_coach(p_card_id uuid, p_includes boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
begin
  select site_id into v_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;

  update public.site_plan_cards
  set includes_coach = coalesce(p_includes, false)
  where id = p_card_id and site_id = v_site_id and owner_card_id is null;
  if not found then
    raise exception 'not authorized';
  end if;
end;
$$;

revoke all on function public.manager_set_plan_card_coach(uuid, boolean) from public, anon;
grant execute on function public.manager_set_plan_card_coach(uuid, boolean) to authenticated;

-- Does the caller's own, live subscription include the coach? (active or in its grace days — not blocked, not none.)
create function public.client_has_coach_plan()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.site_plan_cards c on c.id = s.card_id
    where s.user_id = (select auth.uid())
      and s.status in ('active', 'grace')
      and c.includes_coach
  );
$$;

revoke all on function public.client_has_coach_plan() from public, anon;
grant execute on function public.client_has_coach_plan() to authenticated;

-- The rule itself, enforced where the rating is written (not only hidden in the app).
drop policy "coach_ratings_insert_own" on public.coach_ratings;
create policy "coach_ratings_insert_own" on public.coach_ratings
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and public.client_has_coach_plan()
    and checkin_id in (
      select id from public.checkins
      where user_id = (select auth.uid()) and kind = 'client' and checkout_at is not null
    )
    and coach_id in (
      select p.id from public.profiles p
      where p.role = 'coach' and p.status = 'active'
      and p.site_id = (select c.site_id from public.checkins c where c.id = checkin_id)
    )
  );

-- "Carte abbonamento" — the Manager's own catalog of real membership plans (name, price, duration).
-- Until now the Client app and manager_assign_plan() only ever offered a fixed, hardcoded
-- Monthly/Annual choice with no price anywhere at all — a real gym needs to set its own plan names
-- and prices. Every new subscription snapshots its chosen card's terms onto the row itself
-- (plan_name/price_eur/duration_days), so a Manager editing or deactivating a card later never
-- silently changes what an existing Client already agreed to pay — same principle as
-- point-rules/checkin never retroactively rewriting a past fact.

create table public.site_plan_cards (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(site_id),
  name text not null,
  -- float8, not numeric: matches this project's own convention for every other real-valued column
  -- (lat/lng) and avoids PostgREST's numeric-as-string serialization entirely.
  price_eur float8 not null check (price_eur >= 0),
  duration_days int not null check (duration_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index site_plan_cards_site_id_idx on public.site_plan_cards(site_id);

alter table public.site_plan_cards enable row level security;

create policy "site_plan_cards_select_by_manager" on public.site_plan_cards
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

-- A Client only ever needs their OWN gym's still-offered (active) cards — to choose one at first
-- login, or later to switch. Never another site's catalog.
create policy "site_plan_cards_select_by_client" on public.site_plan_cards
  for select to authenticated
  using (active and site_id in (select site_id from public.profiles where id = (select auth.uid()) and role = 'client'));

-- No insert/update/delete grants at all — every write goes through the SECURITY DEFINER RPCs below,
-- same convention as `subscriptions`/`profiles`.
revoke insert, update, delete on public.site_plan_cards from authenticated, anon;

alter table public.subscriptions add column card_id uuid references public.site_plan_cards(id);
alter table public.subscriptions add column plan_name text;
alter table public.subscriptions add column price_eur float8;
alter table public.subscriptions add column duration_days int;
-- plan_type is now legacy — new rows go through a card instead, so it's no longer always known.
alter table public.subscriptions alter column plan_type drop not null;

-- Backfill existing rows so they keep displaying something sensible (no card, no real price — just
-- the two fixed choices this feature replaces).
update public.subscriptions
set plan_name = case plan_type when 'monthly' then 'Mensile' when 'annual' then 'Annuale' else plan_name end,
    duration_days = case plan_type when 'monthly' then 30 when 'annual' then 365 else duration_days end
where plan_name is null;

-- ── manager_create_plan_card() / manager_update_plan_card() / manager_set_plan_card_active() ───────
-- Reads go straight through the RLS policy above (`.from('site_plan_cards')`, same pattern as
-- `gym_chains` — select policy + RPC-only writes), no read RPC needed.
create function public.manager_create_plan_card(p_name text, p_price_eur float8, p_duration_days int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
  v_id uuid;
begin
  select site_id into v_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_price_eur < 0 then
    raise exception 'invalid price';
  end if;
  if p_duration_days <= 0 then
    raise exception 'invalid duration';
  end if;

  insert into public.site_plan_cards (site_id, name, price_eur, duration_days)
  values (v_site_id, v_name, p_price_eur, p_duration_days)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.manager_create_plan_card(text, float8, int) from public;
grant execute on function public.manager_create_plan_card(text, float8, int) to authenticated;

create function public.manager_update_plan_card(p_card_id uuid, p_name text, p_price_eur float8, p_duration_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
begin
  select site_id into v_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_price_eur < 0 then
    raise exception 'invalid price';
  end if;
  if p_duration_days <= 0 then
    raise exception 'invalid duration';
  end if;

  update public.site_plan_cards
  set name = v_name, price_eur = p_price_eur, duration_days = p_duration_days
  where id = p_card_id and site_id = v_site_id;
  if not found then
    raise exception 'not authorized';
  end if;
end;
$$;

revoke all on function public.manager_update_plan_card(uuid, text, float8, int) from public;
grant execute on function public.manager_update_plan_card(uuid, text, float8, int) to authenticated;

-- Soft delete (never a hard DELETE): existing subscriptions keep a valid card_id/foreign key and
-- their own already-snapshotted terms even after the Manager retires the card from new signups.
create function public.manager_set_plan_card_active(p_card_id uuid, p_active boolean)
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

  update public.site_plan_cards set active = p_active where id = p_card_id and site_id = v_site_id;
  if not found then
    raise exception 'not authorized';
  end if;
end;
$$;

revoke all on function public.manager_set_plan_card_active(uuid, boolean) from public;
grant execute on function public.manager_set_plan_card_active(uuid, boolean) to authenticated;

-- ── client_choose_plan() / manager_assign_plan() / client_switch_plan() — now take a card id, not a
-- fixed 'monthly'/'annual' enum value; each snapshots the card's current name/price/duration ────────
drop function if exists public.client_choose_plan(public.subscription_plan);

create function public.client_choose_plan(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_card record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_site_id from public.profiles where id = v_uid and role = 'client';
  if v_site_id is null then
    raise exception 'not a client';
  end if;
  if exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'subscription already exists';
  end if;

  select * into v_card from public.site_plan_cards where id = p_card_id and site_id = v_site_id and active;
  if not found then
    raise exception 'plan not available';
  end if;

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days)
  values (v_uid, v_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days);
end;
$$;

revoke all on function public.client_choose_plan(uuid) from public;
grant execute on function public.client_choose_plan(uuid) to authenticated;

drop function if exists public.manager_assign_plan(uuid, public.subscription_plan);

create function public.manager_assign_plan(p_client_id uuid, p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_manager_site_id text;
  v_client_site_id text;
  v_card record;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_manager_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_manager_site_id is null then
    raise exception 'not a manager';
  end if;
  select site_id into v_client_site_id from public.profiles where id = p_client_id and role = 'client';
  if v_client_site_id is distinct from v_manager_site_id then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from public.subscriptions where user_id = p_client_id) then
    raise exception 'subscription already exists';
  end if;

  select * into v_card from public.site_plan_cards where id = p_card_id and site_id = v_manager_site_id;
  if not found then
    raise exception 'plan not found';
  end if;

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days)
  values (p_client_id, v_client_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days);
end;
$$;

revoke all on function public.manager_assign_plan(uuid, uuid) from public;
grant execute on function public.manager_assign_plan(uuid, uuid) to authenticated;

drop function if exists public.client_switch_plan(public.subscription_plan);

create function public.client_switch_plan(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_card record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_site_id from public.profiles where id = v_uid and role = 'client';
  if v_site_id is null then
    raise exception 'not a client';
  end if;
  if not exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'no subscription to switch';
  end if;

  select * into v_card from public.site_plan_cards where id = p_card_id and site_id = v_site_id and active;
  if not found then
    raise exception 'plan not available';
  end if;

  update public.subscriptions
    set status = 'active', grace_end_date = null, warning_sent_at = null,
        expiry_date = current_date + v_card.duration_days, last_payment_date = current_date, updated_at = now(),
        card_id = v_card.id, plan_name = v_card.name, price_eur = v_card.price_eur, duration_days = v_card.duration_days,
        plan_type = null
    where user_id = v_uid;
end;
$$;

revoke all on function public.client_switch_plan(uuid) from public;
grant execute on function public.client_switch_plan(uuid) to authenticated;

-- ── client_confirm_payment_during_grace() — renews using the subscription's own snapshotted
-- duration_days now, instead of re-deriving a fixed interval from plan_type ───────────────────────
create or replace function public.client_confirm_payment_during_grace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_duration int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select duration_days into v_duration from public.subscriptions where user_id = v_uid and status in ('grace', 'blocked');
  if not found then
    raise exception 'no subscription awaiting payment';
  end if;

  update public.subscriptions
    set status = 'active', grace_end_date = null, warning_sent_at = null,
        expiry_date = current_date + coalesce(v_duration, 30), last_payment_date = current_date, updated_at = now()
    where user_id = v_uid;
end;
$$;

-- ── client_get_my_subscription() / manager_get_client_subscriptions() — surface the real
-- name/price now instead of the fixed monthly/annual label ─────────────────────────────────────────
create or replace function public.client_get_my_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_required boolean;
  v_sub record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select role, subscription_required into v_role, v_required from public.profiles where id = v_uid;
  if v_role <> 'client' then
    return jsonb_build_object('subscription', null, 'needsPlanChoice', false);
  end if;

  select * into v_sub from public.subscriptions where user_id = v_uid;

  if not found then
    return jsonb_build_object('subscription', null, 'needsPlanChoice', coalesce(v_required, false));
  end if;

  return jsonb_build_object(
    'needsPlanChoice', false,
    'subscription', jsonb_build_object(
      'planName', coalesce(v_sub.plan_name, '—'), 'priceEur', v_sub.price_eur, 'status', v_sub.status,
      'startDate', v_sub.start_date, 'expiryDate', v_sub.expiry_date, 'lastPaymentDate', v_sub.last_payment_date,
      'graceEndDate', v_sub.grace_end_date, 'warningSentAt', v_sub.warning_sent_at
    )
  );
end;
$$;

drop function if exists public.manager_get_client_subscriptions();

create function public.manager_get_client_subscriptions()
returns table (
  client_id uuid, full_name text, plan_name text, price_eur float8, status public.subscription_status,
  start_date date, expiry_date date, last_payment_date date
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_manager uuid := auth.uid();
  v_site_id text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;

  return query
  select p.id, p.full_name, s.plan_name, s.price_eur, s.status, s.start_date, s.expiry_date, s.last_payment_date
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  where p.role = 'client' and p.site_id = v_site_id
  order by p.full_name;
end;
$$;

revoke all on function public.manager_get_client_subscriptions() from public;
grant execute on function public.manager_get_client_subscriptions() to authenticated;

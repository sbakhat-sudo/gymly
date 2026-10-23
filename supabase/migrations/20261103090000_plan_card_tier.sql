-- A second, independent axis on top of Mensile/Annuale: "Livello" (Normale/VIP/VVIP) — a purely
-- visual/organizational badge, not a price or privilege rule (those still come entirely from the
-- card's own price_eur/duration_days/description, set by the Manager). VIP/VVIP get their own fixed
-- badge colours (orange/blue) regardless of whichever colour the Manager picked for the card itself.
create type public.plan_card_tier as enum ('normal', 'vip', 'vvip');

alter table public.site_plan_cards add column tier public.plan_card_tier not null default 'normal';

-- Snapshotted/propagated exactly like every other card field (name/price/duration/description/color).
alter table public.subscriptions add column plan_tier public.plan_card_tier;

drop function if exists public.manager_create_plan_card(text, float8, int, text, text);

create function public.manager_create_plan_card(
  p_name text, p_price_eur float8, p_duration_days int, p_description text default null, p_color text default null,
  p_tier public.plan_card_tier default 'normal'
)
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

  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, description, color, tier)
  values (v_site_id, v_name, p_price_eur, p_duration_days, nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_color, '')), ''), p_tier)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.manager_create_plan_card(text, float8, int, text, text, public.plan_card_tier) from public;
grant execute on function public.manager_create_plan_card(text, float8, int, text, text, public.plan_card_tier) to authenticated;

drop function if exists public.manager_update_plan_card(uuid, text, float8, int, text, text);

create function public.manager_update_plan_card(
  p_card_id uuid, p_name text, p_price_eur float8, p_duration_days int, p_description text default null, p_color text default null,
  p_tier public.plan_card_tier default 'normal'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_color text := nullif(trim(coalesce(p_color, '')), '');
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
  set name = v_name, price_eur = p_price_eur, duration_days = p_duration_days, description = v_description, color = v_color, tier = p_tier
  where id = p_card_id and site_id = v_site_id;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.subscriptions
  set plan_name = v_name, price_eur = p_price_eur, duration_days = p_duration_days, plan_description = v_description, plan_tier = p_tier,
      expiry_date = start_date + p_duration_days, updated_at = now()
  where card_id = p_card_id;
end;
$$;

revoke all on function public.manager_update_plan_card(uuid, text, float8, int, text, text, public.plan_card_tier) from public;
grant execute on function public.manager_update_plan_card(uuid, text, float8, int, text, text, public.plan_card_tier) to authenticated;

create or replace function public.client_choose_plan(p_card_id uuid)
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

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days, plan_description, plan_tier)
  values (v_uid, v_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days, v_card.description, v_card.tier);
end;
$$;

create or replace function public.manager_assign_plan(p_client_id uuid, p_card_id uuid)
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

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days, plan_description, plan_tier)
  values (p_client_id, v_client_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days, v_card.description, v_card.tier);
end;
$$;

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
      'planName', coalesce(v_sub.plan_name, '—'), 'priceEur', v_sub.price_eur, 'planDescription', v_sub.plan_description,
      'planTier', v_sub.plan_tier, 'status', v_sub.status,
      'startDate', v_sub.start_date, 'expiryDate', v_sub.expiry_date, 'lastPaymentDate', v_sub.last_payment_date,
      'graceEndDate', v_sub.grace_end_date, 'warningSentAt', v_sub.warning_sent_at
    )
  );
end;
$$;

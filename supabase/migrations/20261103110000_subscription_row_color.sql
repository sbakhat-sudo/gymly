-- The Manager's client table shows which plan each row has, but not its colour — same gap the plan
-- cards themselves had before colour existed. Snapshotted/propagated exactly like every other card
-- field (name/price/duration/description/tier): manager_update_plan_card() keeps it in sync, so
-- recolouring a card recolours every row already using it too.
alter table public.subscriptions add column plan_color text;

create or replace function public.manager_update_plan_card(
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
  set plan_name = v_name, price_eur = p_price_eur, duration_days = p_duration_days, plan_description = v_description, plan_tier = p_tier, plan_color = v_color,
      expiry_date = start_date + p_duration_days, updated_at = now()
  where card_id = p_card_id;
end;
$$;

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

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days, plan_description, plan_tier, plan_color)
  values (v_uid, v_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days, v_card.description, v_card.tier, v_card.color);
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

  insert into public.subscriptions (user_id, site_id, status, start_date, expiry_date, last_payment_date, card_id, plan_name, price_eur, duration_days, plan_description, plan_tier, plan_color)
  values (p_client_id, v_client_site_id, 'active', current_date, current_date + v_card.duration_days, current_date, v_card.id, v_card.name, v_card.price_eur, v_card.duration_days, v_card.description, v_card.tier, v_card.color);
end;
$$;

drop function if exists public.manager_get_client_subscriptions();

create function public.manager_get_client_subscriptions()
returns table (
  client_id uuid, full_name text, plan_name text, price_eur float8, plan_color text, status public.subscription_status,
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
  select p.id, p.full_name, s.plan_name, s.price_eur, s.plan_color, s.status, s.start_date, s.expiry_date, s.last_payment_date
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  where p.role = 'client' and p.site_id = v_site_id
  order by p.full_name;
end;
$$;

revoke all on function public.manager_get_client_subscriptions() from public;
grant execute on function public.manager_get_client_subscriptions() to authenticated;

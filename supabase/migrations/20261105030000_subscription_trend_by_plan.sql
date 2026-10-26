-- The Owner dashboard's "Abbonamenti per mese" chart used to show six fixed series
-- (Mensile/Annuale x Normale/VIP/VVIP). It now follows the real subscriptions: one series per plan the
-- clients actually chose — every Owner-made plan, plus any plan a Manager made that someone paid for.
--
-- Each logged payment now remembers which plan it was (`plan_key`, name, colour). The key is the
-- Owner's own plan id when the plan came from the Owner, otherwise the plan's name (so two gyms'
-- identically named Manager plans count as one). Renaming/recolouring an Owner plan rewrites its history
-- too, so a series never splits in two.

alter table public.subscription_payments add column plan_key text;
alter table public.subscription_payments add column plan_name text;
alter table public.subscription_payments add column plan_color text;

-- Payments already on record: take the plan from the member's current subscription.
update public.subscription_payments sp
set plan_name = coalesce(s.plan_name, case sp.kind when 'annual' then 'Annuale' else 'Mensile' end),
    plan_color = s.plan_color,
    plan_key = coalesce(
      (select c.owner_card_id::text from public.site_plan_cards c where c.id = s.card_id),
      'n:' || lower(coalesce(s.plan_name, case sp.kind when 'annual' then 'Annuale' else 'Mensile' end))
    )
from public.subscriptions s
where s.user_id = sp.user_id;

update public.subscription_payments
set plan_name = case kind when 'annual' then 'Annuale' else 'Mensile' end
where plan_name is null;
update public.subscription_payments set plan_key = 'n:' || lower(plan_name) where plan_key is null;

alter table public.subscription_payments alter column plan_key set not null;
alter table public.subscription_payments alter column plan_name set not null;

create or replace function public.subscriptions_log_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_owner_card uuid;
begin
  if new.last_payment_date is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.last_payment_date is not distinct from old.last_payment_date
     and new.expiry_date is not distinct from old.expiry_date then
    return new;
  end if;

  v_name := coalesce(new.plan_name, case when new.duration_days % 365 = 0 then 'Annuale' else 'Mensile' end);
  select c.owner_card_id into v_owner_card from public.site_plan_cards c where c.id = new.card_id;

  insert into public.subscription_payments (user_id, site_id, paid_on, kind, tier, price_eur, plan_key, plan_name, plan_color)
  values (
    new.user_id,
    new.site_id,
    new.last_payment_date,
    case when new.duration_days % 365 = 0 then 'annual' else 'monthly' end,
    coalesce(new.plan_tier::text, 'normal'),
    coalesce(new.price_eur, 0),
    coalesce(v_owner_card::text, 'n:' || lower(v_name)),
    v_name,
    new.plan_color
  );
  return new;
end;
$$;

-- Editing an Owner plan keeps its history under the same series.
create or replace function public.owner_update_plan_card(
  p_card_id uuid, p_name text, p_kind text, p_price_eur float8, p_description text default null, p_color text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_color text := nullif(trim(coalesce(p_color, '')), '');
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
  if p_price_eur is null or p_price_eur < 0 then
    raise exception 'invalid price';
  end if;

  update public.owner_plan_cards
  set name = v_name, kind = p_kind, price_eur = p_price_eur, description = v_description, color = v_color
  where id = p_card_id and chain_id = v_chain;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.site_plan_cards
  set name = v_name, duration_days = v_days, price_eur = p_price_eur, description = v_description, color = v_color
  where owner_card_id = p_card_id;

  update public.subscriptions
  set plan_name = v_name, duration_days = v_days, price_eur = p_price_eur, plan_description = v_description, plan_color = v_color,
      expiry_date = start_date + v_days, updated_at = now()
  where card_id in (select id from public.site_plan_cards where owner_card_id = p_card_id);

  update public.subscription_payments
  set plan_name = v_name, plan_color = v_color, kind = p_kind
  where plan_key = p_card_id::text;
end;
$$;

-- ── The chart: payments per month, per plan ───────────────────────────────────────────────────────
-- Series = every current Owner plan (zeros included, so a brand-new plan already has its place) plus any
-- other plan someone paid for in the window. Always every month x every series, oldest month first.
drop function if exists public.owner_get_subscription_trend(int);

create function public.owner_get_subscription_trend(p_months int default 6)
returns table (
  month_start date,
  plan_key text,
  plan_name text,
  plan_color text,
  kind text,
  subscribers int,
  revenue_eur float8
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
declare
  v_chain uuid := public.owner_chain_id();
  v_from date := (date_trunc('month', current_date) - make_interval(months => greatest(1, least(coalesce(p_months, 6), 24)) - 1))::date;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;

  return query
  with months as (
    select g::date as d
    from generate_series(v_from::timestamptz, date_trunc('month', current_date), interval '1 month') g
  ),
  chain_payments as (
    select sp.*
    from public.subscription_payments sp
    where v_chain is not null and sp.site_id in (select s.site_id from public.sites s where s.chain_id = v_chain)
  ),
  plans as (
    select o.id::text as pkey, o.name as pname, o.color as pcolor, o.kind as pkind, o.created_at as first_seen
    from public.owner_plan_cards o
    where o.chain_id = v_chain
    union all
    select cp.plan_key,
           (array_agg(cp.plan_name order by cp.paid_on desc))[1],
           (array_agg(cp.plan_color order by cp.paid_on desc))[1],
           (array_agg(cp.kind order by cp.paid_on desc))[1],
           min(cp.created_at)
    from chain_payments cp
    where cp.paid_on >= v_from
      and cp.plan_key not in (select o.id::text from public.owner_plan_cards o where o.chain_id = v_chain)
    group by cp.plan_key
  ),
  counts as (
    select date_trunc('month', cp.paid_on)::date as mo, cp.plan_key as pkey, count(*)::int as cnt, sum(cp.price_eur) as rev
    from chain_payments cp
    group by 1, 2
  )
  select m.d, p.pkey, p.pname, p.pcolor, p.pkind, coalesce(c.cnt, 0), coalesce(c.rev, 0)::float8
  from months m
  cross join plans p
  left join counts c on c.mo = m.d and c.pkey = p.pkey
  order by m.d, p.first_seen, p.pname;
end;
$$;

revoke all on function public.owner_get_subscription_trend(int) from public, anon;
grant execute on function public.owner_get_subscription_trend(int) to authenticated;

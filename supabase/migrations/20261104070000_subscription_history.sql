-- Month-by-month history of member subscriptions, for the Owner dashboard's chart.
--
-- `subscriptions` holds ONE row per member (primary key user_id) and every payment overwrites it, so
-- "how many people bought each plan in October" can't be answered from it once the next month arrives.
-- This keeps a row per payment instead, written by a trigger so no existing payment path (first purchase,
-- renewal, plan switch, Manager marking someone as paid) needs to know about it. History starts with the
-- payments already on record (each member's last payment); anything before that was never stored, and the
-- chart shows it as zero rather than guessing.

create table public.subscription_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  site_id text not null,
  paid_on date not null,
  -- Same split the dashboard already uses: a duration that is a whole number of years is annual.
  kind text not null check (kind in ('monthly', 'annual')),
  tier text not null check (tier in ('normal', 'vip', 'vvip')),
  price_eur float8 not null default 0,
  created_at timestamptz not null default now()
);

create index subscription_payments_site_paid_idx on public.subscription_payments (site_id, paid_on);

-- No policies and no grants: only the SECURITY DEFINER function below ever reads it.
alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from anon, authenticated;

-- ── Log every payment as it happens ───────────────────────────────────────────────────────────────
create function public.subscriptions_log_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_payment_date is null then
    return new;
  end if;
  -- A payment is a new subscription row, or an update that moved the payment/expiry date. The hourly
  -- lifecycle job (active -> grace -> blocked) touches neither, so it never logs a phantom payment.
  if tg_op = 'UPDATE'
     and new.last_payment_date is not distinct from old.last_payment_date
     and new.expiry_date is not distinct from old.expiry_date then
    return new;
  end if;

  insert into public.subscription_payments (user_id, site_id, paid_on, kind, tier, price_eur)
  values (
    new.user_id,
    new.site_id,
    new.last_payment_date,
    case when new.duration_days % 365 = 0 then 'annual' else 'monthly' end,
    coalesce(new.plan_tier::text, 'normal'),
    coalesce(new.price_eur, 0)
  );
  return new;
end;
$$;

revoke all on function public.subscriptions_log_payment() from public, anon, authenticated;

create trigger subscriptions_log_payment
after insert or update on public.subscriptions
for each row execute function public.subscriptions_log_payment();

-- The payments already on record: one per member, dated at their last payment.
insert into public.subscription_payments (user_id, site_id, paid_on, kind, tier, price_eur)
select
  user_id,
  site_id,
  last_payment_date,
  case when duration_days % 365 = 0 then 'annual' else 'monthly' end,
  coalesce(plan_tier::text, 'normal'),
  coalesce(price_eur, 0)
from public.subscriptions
where last_payment_date is not null;

-- ── The Owner's chart: payments per month, per kind and tier ──────────────────────────────────────
-- Always every month x six types (zeros included), oldest month first, so the chart never has holes.
create function public.owner_get_subscription_trend(p_months int default 6)
returns table (
  month_start date,
  kind text,
  tier text,
  subscribers int,
  revenue_eur float8
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_months int := greatest(1, least(coalesce(p_months, 6), 24));
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;

  return query
  select
    m.d::date,
    k.kind,
    t.tier,
    coalesce(c.cnt, 0)::int,
    coalesce(c.rev, 0)::float8
  from generate_series(
         date_trunc('month', current_date) - make_interval(months => v_months - 1),
         date_trunc('month', current_date),
         interval '1 month'
       ) as m(d)
  cross join (values ('monthly'), ('annual')) k(kind)
  cross join (values ('normal'), ('vip'), ('vvip')) t(tier)
  left join (
    select date_trunc('month', sp.paid_on)::date as mo, sp.kind as kd, sp.tier as tr, count(*)::int as cnt, sum(sp.price_eur) as rev
    from public.subscription_payments sp
    where v_chain is not null and sp.site_id in (select s.site_id from public.sites s where s.chain_id = v_chain)
    group by 1, 2, 3
  ) c on c.mo = m.d::date and c.kd = k.kind and c.tr = t.tier
  order by m.d, (k.kind = 'annual'), array_position(array['normal', 'vip', 'vvip'], t.tier);
end;
$$;

revoke all on function public.owner_get_subscription_trend(int) from public, anon;
grant execute on function public.owner_get_subscription_trend(int) to authenticated;

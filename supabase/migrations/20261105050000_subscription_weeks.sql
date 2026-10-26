-- Week-by-week view of one month for the Owner's stacked chart ("Sett. 1 (2-5/10)" ...). Same plans as the
-- monthly chart (every Owner plan, zeros included, plus any other plan someone paid for that month), same
-- payments log. Weeks run Monday-Sunday and are clipped to the month, so the first and last can be short.
create function public.owner_get_subscription_weeks(p_month date default null)
returns table (
  week_no int,
  range_start date,
  range_end date,
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
  v_first date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_last date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month' - interval '1 day')::date;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;

  return query
  with weeks as (
    select (row_number() over (order by w.wk))::int as wno, greatest(w.wk, v_first) as rstart, least(w.wk + 6, v_last) as rend
    from (
      select distinct date_trunc('week', g)::date as wk
      from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') g
    ) w
  ),
  chain_payments as (
    select sp.*
    from public.subscription_payments sp
    where v_chain is not null
      and sp.paid_on between v_first and v_last
      and sp.site_id in (select s.site_id from public.sites s where s.chain_id = v_chain)
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
    where cp.plan_key not in (select o.id::text from public.owner_plan_cards o where o.chain_id = v_chain)
    group by cp.plan_key
  ),
  counts as (
    select w.wno as wno, cp.plan_key as pkey, count(*)::int as cnt, sum(cp.price_eur) as rev
    from chain_payments cp
    join weeks w on cp.paid_on between w.rstart and w.rend
    group by 1, 2
  )
  select w.wno, w.rstart, w.rend, p.pkey, p.pname, p.pcolor, p.pkind, coalesce(c.cnt, 0), coalesce(c.rev, 0)::float8
  from weeks w
  cross join plans p
  left join counts c on c.wno = w.wno and c.pkey = p.pkey
  order by w.wno, p.first_seen, p.pname;
end;
$$;

revoke all on function public.owner_get_subscription_weeks(date) from public, anon;
grant execute on function public.owner_get_subscription_weeks(date) to authenticated;

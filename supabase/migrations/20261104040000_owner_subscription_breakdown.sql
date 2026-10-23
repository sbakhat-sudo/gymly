-- The Owner dashboard's "Fatturato" showed the wrong thing: it summed what each gym's Gymly plan costs
-- (pro 49 / business 129 per site), not what the Owner's own members pay. That number is kept as
-- `planCostEur`; `revenueEur` is now the real money coming in from members' subscriptions, and a new
-- `subscriptions` list says how many people are on each kind of plan:
--   Mensile x {Normale, VIP, VVIP} and Annuale x {Normale, VIP, VVIP}  (always all six, zeros included).
--
-- "On a plan" = a subscription whose status is 'active' (paid and not expired — grace/blocked ones have
-- stopped paying, so they are neither counted nor added to the money). Annual vs monthly follows the
-- same rule the Manager's own plan editor uses: a duration that is a whole number of years is annual,
-- anything else monthly. A subscription from before tiers existed has no tier and counts as Normale.
create or replace function public.owner_get_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_managers int;
  v_clients int;
  v_coaches int;
  v_revenue numeric;
  v_plan_cost numeric;
  v_subscriptions jsonb;
  v_activity jsonb;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    return jsonb_build_object(
      'managers', 0, 'clients', 0, 'coaches', 0, 'revenueEur', 0, 'planCostEur', 0,
      'subscriptions', '[]'::jsonb, 'activity7d', '[]'::jsonb
    );
  end if;

  select count(*) into v_managers from public.sites where chain_id = v_chain;
  select count(*) into v_clients from public.profiles where role = 'client' and site_id in (select site_id from public.sites where chain_id = v_chain);
  select count(*) into v_coaches from public.profiles where role = 'coach' and site_id in (select site_id from public.sites where chain_id = v_chain);

  select coalesce(sum(case plan when 'pro' then 49 when 'business' then 129 else 0 end), 0)
    into v_plan_cost
    from public.sites where chain_id = v_chain;

  select coalesce(sum(price_eur), 0)
    into v_revenue
    from public.subscriptions
    where status = 'active' and site_id in (select site_id from public.sites where chain_id = v_chain);

  select jsonb_agg(
           jsonb_build_object('kind', k.kind, 'tier', t.tier, 'count', coalesce(c.cnt, 0), 'revenueEur', coalesce(c.rev, 0))
           order by (k.kind = 'annual'), array_position(array['normal', 'vip', 'vvip'], t.tier)
         )
    into v_subscriptions
    from (values ('monthly'), ('annual')) k(kind)
    cross join (values ('normal'), ('vip'), ('vvip')) t(tier)
    left join (
      select
        case when s.duration_days % 365 = 0 then 'annual' else 'monthly' end as kind,
        coalesce(s.plan_tier::text, 'normal') as tier,
        count(*)::int as cnt,
        sum(s.price_eur) as rev
      from public.subscriptions s
      where s.status = 'active' and s.site_id in (select site_id from public.sites where chain_id = v_chain)
      group by 1, 2
    ) c on c.kind = k.kind and c.tier = t.tier;

  select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(c.cnt, 0)) order by d), '[]'::jsonb)
    into v_activity
    from generate_series(current_date - interval '6 days', current_date, '1 day'::interval) d
    left join (
      select date_trunc('day', checkin_at) as day, count(*) as cnt
      from public.checkins
      where site_id in (select site_id from public.sites where chain_id = v_chain)
        and checkin_at >= current_date - interval '6 days'
      group by 1
    ) c on c.day = d;

  return jsonb_build_object(
    'managers', v_managers, 'clients', v_clients, 'coaches', v_coaches,
    'revenueEur', v_revenue, 'planCostEur', v_plan_cost,
    'subscriptions', v_subscriptions, 'activity7d', v_activity
  );
end;
$$;

-- The Owner dashboard's "Fatturato" detail listed six fixed rows (Mensile/Annuale x Normale/VIP/VVIP).
-- It now lists the real subscriptions instead: every Owner-made plan (zeros included, so a new plan
-- already has its row) plus any other plan (a Manager's own) that someone is actively paying for. With no
-- plans and nobody subscribed the list is simply empty. Same grouping key as the monthly chart
-- (20261105030000): the Owner plan's id, otherwise the plan's name.
--
-- Everything else owner_get_overview() returns is unchanged. Only members whose subscription is 'active'
-- (paid, not expired) count, exactly as before.
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

  with active_subs as (
    select
      coalesce(
        (select c.owner_card_id::text from public.site_plan_cards c where c.id = s.card_id),
        'n:' || lower(coalesce(s.plan_name, case when s.duration_days % 365 = 0 then 'Annuale' else 'Mensile' end))
      ) as pkey,
      coalesce(s.plan_name, case when s.duration_days % 365 = 0 then 'Annuale' else 'Mensile' end) as pname,
      s.plan_color as pcolor,
      case when s.duration_days % 365 = 0 then 'annual' else 'monthly' end as pkind,
      s.price_eur as price
    from public.subscriptions s
    where s.status = 'active' and s.site_id in (select site_id from public.sites where chain_id = v_chain)
  ),
  plans as (
    select o.id::text as pkey, o.name as pname, o.color as pcolor, o.kind as pkind, o.created_at as first_seen
    from public.owner_plan_cards o
    where o.chain_id = v_chain
    union all
    select a.pkey, min(a.pname), min(a.pcolor), min(a.pkind), now()
    from active_subs a
    where a.pkey not in (select o.id::text from public.owner_plan_cards o where o.chain_id = v_chain)
    group by a.pkey
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'planKey', p.pkey, 'name', p.pname, 'color', p.pcolor, 'kind', p.pkind,
               'count', (select count(*) from active_subs a where a.pkey = p.pkey),
               'revenueEur', (select coalesce(sum(a.price), 0) from active_subs a where a.pkey = p.pkey)
             )
             order by p.first_seen, p.pname
           ),
           '[]'::jsonb
         )
    into v_subscriptions
    from plans p;

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

-- One "Attività" feed per role, shown in each role's Impostazioni:
--   Owner   sees what its Managers, Coaches and Clients did (its own chain's gyms only);
--   Admin   sees what Owners, Coaches and Clients did (every gym);
--   Manager sees what its Clients and Coaches did (its own gym only).
-- Events: check-in / check-out, subscription payments, coach ratings and issue reports sent, account
-- created / activated / deactivated, and the last sign-in. Deliberately no free text from members (rating
-- comments, issue descriptions): the feed says WHO did WHAT and WHEN, never the content.
--
-- Read-only and computed on the fly from the tables that already record these facts — no new table, no
-- trigger. Newest first, paged with a cursor (`p_before` = the oldest `event_at` already on screen).

create function public.get_activity_feed(p_limit int default 40, p_before timestamptz default null, p_role text default null)
returns table (
  event_at timestamptz,
  event_type text,
  actor_id uuid,
  actor_name text,
  actor_role text,
  detail text
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
  v_roles text[];
  v_all boolean := false;
  v_sites text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if public.is_admin() then
    v_roles := array['owner', 'coach', 'client'];
    v_all := true;
  elsif public.is_owner() then
    v_roles := array['manager', 'coach', 'client'];
    select coalesce(array_agg(s.site_id), '{}') into v_sites from public.sites s where s.chain_id = public.owner_chain_id();
  elsif exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'manager' and p.status = 'active') then
    v_roles := array['client', 'coach'];
    select coalesce(array_agg(p.site_id), '{}') into v_sites from public.profiles p where p.id = v_uid and p.site_id is not null;
  else
    raise exception 'not authorized';
  end if;

  return query
  with actors as (
    select p.id as aid, coalesce(nullif(trim(p.full_name), ''), '—') as aname, p.role::text as arole,
           p.created_at as acreated, p.activated_at as aactivated, p.deactivated_at as adeactivated
    from public.profiles p
    where p.role::text = any(v_roles)
      and (p_role is null or p.role::text = p_role)
      and (v_all or p.site_id = any(v_sites))
  ),
  ev as (
    select c.checkin_at as e_at, 'checkin'::text as e_type, a.aid, a.aname, a.arole, null::text as e_detail
    from public.checkins c join actors a on a.aid = c.user_id
    union all
    select c.checkout_at, 'checkout', a.aid, a.aname, a.arole, null
    from public.checkins c join actors a on a.aid = c.user_id
    where c.checkout_at is not null
    union all
    select sp.paid_on::timestamptz, 'payment', a.aid, a.aname, a.arole,
           sp.plan_name || ' · €' || to_char(sp.price_eur, 'FM999990.00')
    from public.subscription_payments sp join actors a on a.aid = sp.user_id
    union all
    select r.created_at, 'rating', a.aid, a.aname, a.arole, r.rating::text || '/5'
    from public.coach_ratings r join actors a on a.aid = r.client_id
    union all
    select i.created_at, 'issue', a.aid, a.aname, a.arole, i.severity::text
    from public.issue_reports i join actors a on a.aid = i.client_id
    union all
    select a.acreated, 'account_created', a.aid, a.aname, a.arole, null from actors a
    union all
    select a.aactivated, 'activated', a.aid, a.aname, a.arole, null from actors a where a.aactivated is not null
    union all
    select a.adeactivated, 'deactivated', a.aid, a.aname, a.arole, null from actors a where a.adeactivated is not null
    union all
    select u.last_sign_in_at, 'sign_in', a.aid, a.aname, a.arole, null
    from actors a join auth.users u on u.id = a.aid
    where u.last_sign_in_at is not null
  )
  select ev.e_at, ev.e_type, ev.aid, ev.aname, ev.arole, ev.e_detail
  from ev
  where ev.e_at is not null and (p_before is null or ev.e_at < p_before)
  order by ev.e_at desc
  limit v_limit;
end;
$$;

revoke all on function public.get_activity_feed(int, timestamptz, text) from public, anon;
grant execute on function public.get_activity_feed(int, timestamptz, text) to authenticated;

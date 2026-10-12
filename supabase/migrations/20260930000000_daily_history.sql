-- Real "past days" history for the Client's Orari tab: an aggregate-only, SECURITY DEFINER RPC
-- (mirrors create_manager_site / set_profile_status). It runs the count -> band conversion in SQL
-- so the client app never receives a raw people count over the wire, only band labels — the same
-- "never a count" rule the mock curve already enforces client-side. Only coach check-ins (kind =
-- 'coach', work presence) are excluded; a coach's own presence never inflates the occupancy band.
create or replace function public.get_daily_bands(p_site_id text, p_days int default 14)
returns table (date_key date, band text)
language sql
security definer
set search_path = public
as $$
  with s as (
    select timezone, capacity_reference from public.sites where site_id = p_site_id
  ),
  daily as (
    select (c.checkin_at at time zone s.timezone)::date as date_key,
           count(distinct c.user_id) as cnt
    from public.checkins c, s
    where c.site_id = p_site_id
      and c.kind = 'client'
      and c.checkin_at >= now() - (greatest(p_days, 0) || ' days')::interval
    group by date_key
  )
  select d.date_key,
         case
           when (d.cnt::numeric / s.capacity_reference) > 0.75 then 'red'
           when (d.cnt::numeric / s.capacity_reference) >= 0.40 then 'amber'
           else 'green'
         end as band
  from daily d, s
  order by d.date_key;
$$;

grant execute on function public.get_daily_bands(text, int) to authenticated;

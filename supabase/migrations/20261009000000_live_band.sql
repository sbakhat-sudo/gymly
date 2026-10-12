-- Replaces the simulated daily curve behind the Live tab's band (Manager's "Situazione" and a real
-- Client's "Live") with the real, current headcount: open client check-ins (kind='client',
-- checkout_at is null) right now, mapped to a band with the exact same 0.40/0.75 thresholds as
-- get_week_real_bands/get_weekly_stats. Aggregate-only, SECURITY DEFINER — the client never
-- receives a raw count, only a band, same as every other real-data RPC in this project.
create or replace function public.get_live_band(p_site_id text)
returns text
language sql
security definer
set search_path = public
as $$
  with s as (
    select capacity_reference from public.sites where site_id = p_site_id
  ),
  live as (
    select count(*) as cnt
    from public.checkins
    where site_id = p_site_id and kind = 'client' and checkout_at is null
  )
  select
    case
      when (live.cnt::numeric / s.capacity_reference) > 0.75 then 'red'
      when (live.cnt::numeric / s.capacity_reference) >= 0.40 then 'amber'
      else 'green'
    end
  from live, s;
$$;

grant execute on function public.get_live_band(text) to authenticated;

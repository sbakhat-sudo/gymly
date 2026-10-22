-- The "sei vicino alla palestra" background proximity alert (useSyncGeofences.ts) was reusing
-- `sites.radius` — the CHECK-IN validation radius (default 150m, +50m tolerance inside check_in(),
-- see 20260930040000) — as its own trigger distance too. That conflates two different concepts: how
-- close you must be to be ALLOWED to check in, vs. how far out we should notify you that you're
-- approaching. The user explicitly asked for a 200m proximity trigger, independent of (and larger
-- than) the check-in validation radius, so it's now its own column instead of overloading `radius`.
alter table public.sites
  add column if not exists proximity_radius int not null default 200;

drop function if exists public.get_site_geofence(text);

create function public.get_site_geofence(p_site_id text)
returns table (lat float8, lng float8, radius int, proximity_radius int)
language sql
security invoker
stable
set search_path = public
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng, radius, proximity_radius
  from public.sites
  where site_id = p_site_id and location is not null;
$$;

revoke all on function public.get_site_geofence(text) from public;
grant execute on function public.get_site_geofence(text) to authenticated;

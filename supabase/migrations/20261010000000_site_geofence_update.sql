-- Lets a Manager (their own gym only) or an Admin (any gym) set/update a site's geofence centre
-- and radius from the app, instead of only ever via a one-off SQL edit. Reuses the exact same
-- `location` (geography Point, 4326) / `radius` columns `check_in()` already reads — see
-- 20260930040000_geofencing_checkin.sql — and the same ownership-check / is_admin() permission
-- patterns already used by manager_set_person_name / admin_set_site_status respectively.
--
-- Note: `p_site_id` is `text` here, not `uuid` — this project's `sites.site_id` has always been a
-- text id (e.g. "st_..."), never a uuid; see every other manager_*/admin_* RPC in this file's
-- migrations directory for the same convention.

create or replace function public.manager_set_site_location(p_site_id text, p_lat double precision, p_lng double precision, p_radius int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;

  -- A single ownership check, not a separate "site not found" step first: telling a non-owner
  -- "this site doesn't exist" vs "you don't own it" would leak which site_ids are real.
  if not exists (select 1 from public.sites where site_id = p_site_id and manager_id = v_manager) then
    raise exception 'not authorized';
  end if;

  update public.sites
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      radius = p_radius
  where site_id = p_site_id;
end;
$$;

revoke all on function public.manager_set_site_location(text, double precision, double precision, int) from public;
grant execute on function public.manager_set_site_location(text, double precision, double precision, int) to authenticated;

create or replace function public.admin_set_site_location(p_site_id text, p_lat double precision, p_lng double precision, p_radius int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.sites
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      radius = p_radius
  where site_id = p_site_id;

  if not found then
    raise exception 'site not found';
  end if;
end;
$$;

revoke all on function public.admin_set_site_location(text, double precision, double precision, int) from public;
grant execute on function public.admin_set_site_location(text, double precision, double precision, int) to authenticated;

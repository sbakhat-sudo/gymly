-- Lets the Manager configure their OWN gym's occupancy thresholds as plain headcounts (e.g. "under
-- 15 = quiet, 15–35 = moderate, over 35 = full") instead of the fixed 40%/75%-of-capacity split that
-- was hardcoded into `get_live_band`. Scoped to the Manager (their own gym only) — Admin keeps no
-- separate editor for this, same boundary the rest of this project draws around capacity settings.
--
-- `get_live_band` already has a stable signature (`p_site_id text`, `returns text`), so
-- `create or replace function` is enough — no drop needed. `create_manager_site()` is touched too, so
-- a brand-new gym starts with a sane default (the same 40%/75% split, computed once at creation time
-- from whatever capacity it starts with) instead of two NULLs.

alter table public.sites
  add column band_green_max int,
  add column band_amber_max int,
  add column notify_manager_on_threshold boolean not null default false;

-- Backfill every existing gym with the equivalent of the old 40%/75% ratio split, so switching to
-- absolute thresholds doesn't silently change what band anyone's gym reads as today.
update public.sites
set band_green_max = greatest(1, round(capacity_reference * 0.40)::int),
    band_amber_max = greatest(greatest(1, round(capacity_reference * 0.40)::int) + 1, round(capacity_reference * 0.75)::int)
where band_green_max is null;

alter table public.sites
  alter column band_green_max set not null,
  alter column band_amber_max set not null;

alter table public.sites add constraint sites_band_thresholds_valid
  check (band_green_max > 0 and band_green_max < band_amber_max and band_amber_max <= capacity_reference);

grant update (band_green_max, band_amber_max, notify_manager_on_threshold) on public.sites to authenticated;

create or replace function public.create_manager_site(p_name text, p_address text, p_timezone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_default_capacity int;
  v_plan public.site_plan;
  v_green int;
  v_amber int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select requested_plan into v_plan
  from public.profiles
  where id = v_uid and role = 'manager' and status = 'active' and site_id is null;
  if not found then
    raise exception 'not an approved manager awaiting a gym';
  end if;

  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;
  v_default_capacity := coalesce(v_default_capacity, 50);
  v_green := greatest(1, round(v_default_capacity * 0.40)::int);
  v_amber := greatest(v_green + 1, round(v_default_capacity * 0.75)::int);

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan, band_green_max, band_amber_max)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval', v_default_capacity, coalesce(v_plan, 'trial'), v_green, v_amber);

  update public.profiles set site_id = v_site_id where id = v_uid;

  return v_site_id;
end;
$$;

-- The live band for the Manager's "Situazione" and a real Client's "Live": now a plain headcount
-- comparison against the Manager's own thresholds, not a ratio of capacity_reference.
-- `live.cnt < green` → green, `green <= live.cnt <= amber` → amber, `live.cnt > amber` → red.
create or replace function public.get_live_band(p_site_id text)
returns text
language sql
security definer
set search_path = public
as $$
  with s as (
    select band_green_max, band_amber_max from public.sites where site_id = p_site_id
  ),
  live as (
    select count(*) as cnt
    from public.checkins
    where site_id = p_site_id and kind = 'client' and checkout_at is null
      and checkin_at > now() - interval '12 hours'
  )
  select
    case
      when live.cnt > s.band_amber_max then 'red'
      when live.cnt >= s.band_green_max then 'amber'
      else 'green'
    end
  from live, s;
$$;

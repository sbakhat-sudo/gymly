-- Switches the Manager's occupancy thresholds (20261019000000) from an absolute headcount to a
-- PERCENTAGE of capacity — confirmed explicitly after trying the headcount version: the Manager
-- wants e.g. "green under 30%, red over 70%", so the threshold moves naturally with capacity itself
-- instead of needing to be re-tuned by hand every time capacity changes.

alter table public.sites
  add column band_green_pct int,
  add column band_amber_pct int;

-- Preserve whatever each gym already customized as a headcount, converted to the equivalent
-- percentage — nobody's current split silently resets to the 40/75 default.
update public.sites
set band_green_pct = greatest(1, least(99, round(100.0 * band_green_max / nullif(capacity_reference, 0))::int)),
    band_amber_pct = greatest(2, least(100, round(100.0 * band_amber_max / nullif(capacity_reference, 0))::int))
where band_green_pct is null;

-- Rounding on a tiny gym could land green_pct >= amber_pct — nudge apart rather than leave invalid.
update public.sites set band_amber_pct = band_green_pct + 1 where band_amber_pct <= band_green_pct;

alter table public.sites
  alter column band_green_pct set not null,
  alter column band_amber_pct set not null;

alter table public.sites drop constraint sites_band_thresholds_valid;
alter table public.sites add constraint sites_band_thresholds_pct_valid
  check (band_green_pct > 0 and band_green_pct < band_amber_pct and band_amber_pct <= 100);

alter table public.sites drop column band_green_max;
alter table public.sites drop column band_amber_max;

grant update (band_green_pct, band_amber_pct) on public.sites to authenticated;

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

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan, band_green_pct, band_amber_pct)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval', v_default_capacity, coalesce(v_plan, 'trial'), 40, 75);

  update public.profiles set site_id = v_site_id where id = v_uid;

  return v_site_id;
end;
$$;

-- Back to a ratio comparison, but against the Manager's own percentages instead of the old hardcoded
-- 40/75. `nullif(capacity_reference, 0)` only guards a theoretical zero capacity; the column has a
-- positive default and no UI path sets it to 0.
create or replace function public.get_live_band(p_site_id text)
returns text
language sql
security definer
set search_path = public
as $$
  with s as (
    select capacity_reference, band_green_pct, band_amber_pct from public.sites where site_id = p_site_id
  ),
  live as (
    select count(*) as cnt
    from public.checkins
    where site_id = p_site_id and kind = 'client' and checkout_at is null
      and checkin_at > now() - interval '12 hours'
  )
  select
    case
      when (live.cnt::numeric / nullif(s.capacity_reference, 0)) * 100 > s.band_amber_pct then 'red'
      when (live.cnt::numeric / nullif(s.capacity_reference, 0)) * 100 >= s.band_green_pct then 'amber'
      else 'green'
    end
  from live, s;
$$;

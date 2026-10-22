-- Audit trail for every change to a site's GPS geofence (centre + radius). Until now,
-- `manager_set_site_location` (own gym) and `admin_set_site_location` (ANY gym) silently overwrote
-- `sites.location`/`radius` with no record of who changed what, when, or from what previous value —
-- a real accountability gap once an Admin can move any gym's check-in geofence. Both functions must
-- be dropped first: adding a parameter changes the signature, and `create or replace` cannot do that
-- (same rule as every other RPC signature change in this migrations directory).
--
-- The audit row is written INSIDE the same SECURITY DEFINER transaction as the update, so it can
-- never be skipped. The table itself grants nothing at all to `authenticated`/`anon` — the only way
-- in is through these two functions (write) and `admin_get_gps_audit_log` below (read, admin-only).
-- That also satisfies "not editable/deletable by a normal admin": there is no UPDATE/DELETE path at
-- all, not even for an Admin — only INSERT (from inside the two functions above) and SELECT (via the
-- read-only RPC).

create table public.gps_audit_log (
  id bigint generated always as identity primary key,
  site_id text not null references public.sites(site_id),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  old_lat double precision,
  old_lng double precision,
  old_radius int,
  new_lat double precision not null,
  new_lng double precision not null,
  new_radius int not null,
  -- Best-effort device info from the browser (`navigator.userAgent` — Admin/Manager are web-only
  -- roles). No IP is captured: Supabase requests pass through a connection pooler, so
  -- `inet_client_addr()` inside a SECURITY DEFINER function would record the pooler's address, not
  -- the real caller's — logging it would be misleading, not useful.
  user_agent text
);

create index gps_audit_log_site_idx on public.gps_audit_log(site_id, changed_at desc);

alter table public.gps_audit_log enable row level security;
-- No policy is added on purpose — zero rows reach PostgREST directly either way, from any role.

revoke all on public.gps_audit_log from authenticated, anon;

drop function if exists public.manager_set_site_location(text, double precision, double precision, int);

create function public.manager_set_site_location(
  p_site_id text, p_lat double precision, p_lng double precision, p_radius int, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_old_lat double precision;
  v_old_lng double precision;
  v_old_radius int;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;

  -- A single ownership check, not a separate "site not found" step first: telling a non-owner
  -- "this site doesn't exist" vs "you don't own it" would leak which site_ids are real.
  if not exists (select 1 from public.sites where site_id = p_site_id and manager_id = v_manager) then
    raise exception 'not authorized';
  end if;

  select ST_Y(location::geometry), ST_X(location::geometry), radius
    into v_old_lat, v_old_lng, v_old_radius
    from public.sites where site_id = p_site_id;

  update public.sites
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      radius = p_radius
  where site_id = p_site_id;

  insert into public.gps_audit_log (site_id, changed_by, old_lat, old_lng, old_radius, new_lat, new_lng, new_radius, user_agent)
  values (p_site_id, v_manager, v_old_lat, v_old_lng, v_old_radius, p_lat, p_lng, p_radius, p_user_agent);
end;
$$;

revoke all on function public.manager_set_site_location(text, double precision, double precision, int, text) from public;
grant execute on function public.manager_set_site_location(text, double precision, double precision, int, text) to authenticated;

drop function if exists public.admin_set_site_location(text, double precision, double precision, int);

create function public.admin_set_site_location(
  p_site_id text, p_lat double precision, p_lng double precision, p_radius int, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old_lat double precision;
  v_old_lng double precision;
  v_old_radius int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select ST_Y(location::geometry), ST_X(location::geometry), radius
    into v_old_lat, v_old_lng, v_old_radius
    from public.sites where site_id = p_site_id;

  if not found then
    raise exception 'site not found';
  end if;

  update public.sites
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      radius = p_radius
  where site_id = p_site_id;

  insert into public.gps_audit_log (site_id, changed_by, old_lat, old_lng, old_radius, new_lat, new_lng, new_radius, user_agent)
  values (p_site_id, v_admin, v_old_lat, v_old_lng, v_old_radius, p_lat, p_lng, p_radius, p_user_agent);
end;
$$;

revoke all on function public.admin_set_site_location(text, double precision, double precision, int, text) from public;
grant execute on function public.admin_set_site_location(text, double precision, double precision, int, text) to authenticated;

-- Read-only, admin-only. `p_site_id null` = every site. No "super-admin" tier exists in this schema
-- today (only 'admin'), so this is readable by any Admin account — the same, single elevated role
-- that can change the GPS in the first place. A stricter "admin can write but can't read the log"
-- tier would need a new role added everywhere `is_admin()` is checked; flagged separately, not done
-- here without a decision on that bigger change.
create or replace function public.admin_get_gps_audit_log(p_site_id text default null, p_limit int default 200)
returns table (
  id bigint,
  site_id text,
  site_name text,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz,
  old_lat double precision,
  old_lng double precision,
  old_radius int,
  new_lat double precision,
  new_lng double precision,
  new_radius int,
  user_agent text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select l.id, l.site_id, s.name, l.changed_by, p.full_name, l.changed_at,
         l.old_lat, l.old_lng, l.old_radius, l.new_lat, l.new_lng, l.new_radius, l.user_agent
  from public.gps_audit_log l
  join public.sites s on s.site_id = l.site_id
  left join public.profiles p on p.id = l.changed_by
  where p_site_id is null or l.site_id = p_site_id
  order by l.changed_at desc
  limit greatest(1, least(p_limit, 500));
end;
$$;

revoke all on function public.admin_get_gps_audit_log(text, int) from public;
grant execute on function public.admin_get_gps_audit_log(text, int) to authenticated;

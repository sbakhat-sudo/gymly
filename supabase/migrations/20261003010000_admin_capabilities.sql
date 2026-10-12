-- Admin capabilities: gym approval workflow + platform-wide oversight of accounts and gyms.
-- Run this AFTER 20261003000000_admin_role.sql has finished.

-- ── Gym approval status ──────────────────────────────────────────────────
-- A new gym now waits for Admin approval before members/coaches can find or join it. Existing gyms
-- are grandfathered in as already-active (nothing changes for them); only gyms created from now on
-- start out pending.
create type public.site_approval_status as enum ('pending_approval', 'active', 'suspended');

alter table public.sites add column approval_status public.site_approval_status not null default 'active';
alter table public.sites add column approved_at timestamptz;
update public.sites set approval_status = 'active', approved_at = created_at;
alter table public.sites alter column approval_status set default 'pending_approval';

create or replace function public.create_manager_site(p_name text, p_address text, p_timezone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval');

  insert into public.profiles (id, role, site_id, status)
  values (v_uid, 'manager', v_site_id, 'active');

  return v_site_id;
end;
$$;

-- A gym pending (or no longer) approval can't be found by a new coach/client signing up.
create or replace function public.list_signup_sites()
returns table (site_id text, name text, address text)
language sql
security definer
set search_path = public
stable
as $$
  select site_id, name, address from public.sites where approval_status = 'active' order by name;
$$;

-- `sites_update_own` (existing policy) still lets a manager update their OWN gym, but the blanket
-- column grant it relied on would also let them flip their own `approval_status` straight to
-- 'active' — defeating the whole point of Admin approval. Re-grant without those two columns;
-- only `admin_set_site_status` below (SECURITY DEFINER) may change them.
revoke update on public.sites from authenticated;
grant update (name, address, timezone, staleness_limit_s, opening_hours, capacity_reference, points_enabled, manually_open) on public.sites to authenticated;

-- ── is_admin() — the one safe way any RLS policy checks "is the caller an Admin?" ───────────────
-- SECURITY DEFINER so the lookup bypasses RLS entirely instead of recursing into profiles' own
-- policies; it only ever reveals the caller's own admin status, so it's safe to expose broadly.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admin sees every profile on the platform (Manager already sees its own gym's via profiles_select_by_manager).
create policy "profiles_select_by_admin" on public.profiles
  for select to authenticated using (public.is_admin());

-- ── Admin write actions (all SECURITY DEFINER; is_admin() is checked inside every one) ──────────

create or replace function public.admin_set_site_status(p_site_id text, p_status public.site_approval_status)
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
  set approval_status = p_status, approved_at = case when p_status = 'active' then now() else approved_at end
  where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;
end;
$$;

revoke all on function public.admin_set_site_status(text, public.site_approval_status) from public;
grant execute on function public.admin_set_site_status(text, public.site_approval_status) to authenticated;

-- Deactivate/reactivate any manager, coach or client account on the platform (reuses the existing
-- 'rejected' status, which already blocks sign-in via the client's auth routing) — never another admin.
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role in ('manager', 'coach', 'client')) then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_profile_status(uuid, public.profile_status) from public;
grant execute on function public.admin_set_profile_status(uuid, public.profile_status) to authenticated;

-- A single-row platform overview for the Admin's "Palestre" screen — counts only, never a list of
-- people, consistent with "never a people count" applying here too (this one IS allowed to count,
-- since it's an aggregate about the platform shown only to Admin, not a per-gym occupancy number).
create or replace function public.admin_get_overview()
returns table (
  sites_pending int,
  sites_active int,
  sites_suspended int,
  managers_total int,
  coaches_total int,
  clients_total int,
  checkins_today int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    (select count(*) from public.sites where approval_status = 'pending_approval')::int,
    (select count(*) from public.sites where approval_status = 'active')::int,
    (select count(*) from public.sites where approval_status = 'suspended')::int,
    (select count(*) from public.profiles where role = 'manager')::int,
    (select count(*) from public.profiles where role = 'coach')::int,
    (select count(*) from public.profiles where role = 'client')::int,
    (select count(*) from public.checkins where checkin_at >= date_trunc('day', now()))::int;
end;
$$;

revoke all on function public.admin_get_overview() from public;
grant execute on function public.admin_get_overview() to authenticated;

-- Manager signup is now admin-gated: a new Manager picks a plan (the first thing they see) and
-- waits for Admin approval BEFORE they can create their gym — previously the gym was created
-- immediately at signup and only the resulting SITE waited for approval. request_manager_signup()
-- replaces the manager branch of create_manager_site() at signup time; create_manager_site() itself
-- now runs post-approval and finishes an existing, already-approved Manager profile instead of
-- inserting a brand new one.

alter table public.profiles add column requested_plan public.site_plan;

create or replace function public.request_manager_signup(p_plan public.site_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  insert into public.profiles (id, role, site_id, status, requested_plan)
  values (v_uid, 'manager', null, 'pending', p_plan);
end;
$$;

revoke all on function public.request_manager_signup(public.site_plan) from public;
grant execute on function public.request_manager_signup(public.site_plan) to authenticated;

-- Replaces the 20261004020000 version: now finishes an ALREADY-APPROVED manager profile (created
-- by request_manager_signup + admin_set_profile_status) instead of inserting a brand new one.
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

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval', coalesce(v_default_capacity, 50), coalesce(v_plan, 'trial'));

  update public.profiles set site_id = v_site_id where id = v_uid;

  return v_site_id;
end;
$$;

-- admin_get_overview: add managers_pending so the Dashboard/notification bell can surface this new
-- gate too, not just pending sites.
drop function public.admin_get_overview();

create function public.admin_get_overview()
returns table (
  sites_pending int,
  sites_active int,
  sites_suspended int,
  managers_total int,
  managers_active int,
  managers_pending int,
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
    (select count(*) from public.profiles where role = 'manager' and status = 'active')::int,
    (select count(*) from public.profiles where role = 'manager' and status = 'pending')::int,
    (select count(*) from public.checkins where checkin_at >= date_trunc('day', now()))::int;
end;
$$;

revoke all on function public.admin_get_overview() from public;
grant execute on function public.admin_get_overview() to authenticated;

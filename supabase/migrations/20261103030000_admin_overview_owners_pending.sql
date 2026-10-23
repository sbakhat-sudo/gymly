-- admin_get_overview()'s `managers_pending` (role = 'manager' and status = 'pending') is stale: Manager
-- no longer self-registers at all (an Owner creates one directly, already active — see
-- 20261103000000_owner_signup.sql's own comment), so that count is now permanently ~0 and the
-- Dashboard's notification bell/hero card under-reports real pending approvals, which are Owner
-- signups now. Adds `owners_pending` alongside the existing columns (kept as-is — still an accurate,
-- if now rarely-nonzero, count of legacy pending Managers) instead of replacing them.
drop function public.admin_get_overview();

create function public.admin_get_overview()
returns table (
  sites_pending int,
  sites_active int,
  sites_suspended int,
  managers_total int,
  managers_active int,
  managers_pending int,
  owners_pending int,
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
    (select count(*) from public.profiles where role = 'owner' and status = 'pending')::int,
    (select count(*) from public.checkins where checkin_at >= date_trunc('day', now()))::int;
end;
$$;

revoke all on function public.admin_get_overview() from public;
grant execute on function public.admin_get_overview() to authenticated;

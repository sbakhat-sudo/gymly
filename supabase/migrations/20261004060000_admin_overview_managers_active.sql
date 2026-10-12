-- Dashboard now mirrors the Palestre group's Totali/Attive/Sospesa pattern for Manager too
-- (Totali/Attivi/Disattivati), and drops coach/client counts entirely — Admin's reach is Manager
-- accounts only, and that boundary now holds for this aggregate too, not just the Persone list.
drop function public.admin_get_overview();

create function public.admin_get_overview()
returns table (
  sites_pending int,
  sites_active int,
  sites_suspended int,
  managers_total int,
  managers_active int,
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
    (select count(*) from public.checkins where checkin_at >= date_trunc('day', now()))::int;
end;
$$;

revoke all on function public.admin_get_overview() from public;
grant execute on function public.admin_get_overview() to authenticated;

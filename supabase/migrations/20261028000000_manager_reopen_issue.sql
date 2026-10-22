-- The Manager's "Azioni" menu on an issue row was only ever shown while it was still pending — once
-- resolved, there was nothing left to change, even by mistake. Adds the other half: reopening a
-- resolved issue back to pending, so "Azioni" always has something to do (sever­ity can already be
-- changed at any time via `manager_set_issue_severity`, regardless of status).
create or replace function public.manager_reopen_issue(p_issue_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.issue_reports ir
    join public.checkins c on c.id = ir.checkin_id
    join public.sites s on s.site_id = c.site_id
    where ir.id = p_issue_id and s.manager_id = (select auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  update public.issue_reports set status = 'pending', resolved_at = null where id = p_issue_id;
end;
$$;

revoke all on function public.manager_reopen_issue(bigint) from public;
grant execute on function public.manager_reopen_issue(bigint) to authenticated;

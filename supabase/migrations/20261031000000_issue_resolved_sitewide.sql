-- The Home banner ("il problema che hai segnalato è stato risolto") was scoped to the reporting
-- Client's own issue_reports rows only (issue_reports_select_own) — on request, every Client at the
-- gym should see it when ANY issue there gets resolved, not only the one who filed that report. Also
-- on request, the banner names the actual problem ("il problema del bagno è stato risolto"), so this
-- returns `description` too, not just id/resolved_at.
--
-- Still a fixed system status, never Manager-written text reaching the Client: `description` is the
-- Client's OWN original report text, never anything the Manager wrote — the same "Manager has no
-- channel to the Client" boundary as the rest of this module.
create function public.client_get_site_issues_resolved_today()
returns table (
  id bigint,
  description text,
  resolved_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select ir.id, ir.description, ir.resolved_at
  from public.issue_reports ir
  join public.checkins c on c.id = ir.checkin_id
  where c.site_id = public.my_site_id()
    and ir.status = 'resolved'
    and ir.resolved_at >= date_trunc('day', now());
$$;

revoke all on function public.client_get_site_issues_resolved_today() from public;
grant execute on function public.client_get_site_issues_resolved_today() to authenticated;

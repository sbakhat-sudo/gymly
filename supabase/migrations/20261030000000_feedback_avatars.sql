-- The Client's rating history and the Manager's issue list only ever showed a coloured-initials
-- avatar, never the person's real uploaded photo (`profiles.avatar_url`) — not a missing feature so
-- much as a missing id: neither `client_get_my_ratings()` nor `manager_get_issues()` returned the
-- other person's id, so the app had nothing to look their avatar up by. `manager_get_ratings()`
-- already returns `coach_id` and was already fixed client-side (no migration needed there).
--
-- RLS already allows both reads (unchanged by this migration, just finally used):
--  - `profiles_select_site_coaches` lets any authenticated user at the same site read an active
--    coach's profile (already how `get_my_site_coaches()` works for the rating picker).
--  - `profiles_select_by_manager` lets a Manager read both coach and client profiles at their site.

drop function if exists public.client_get_my_ratings();

create function public.client_get_my_ratings()
returns table (
  id bigint,
  checkin_id bigint,
  created_at timestamptz,
  coach_id uuid,
  coach_name text,
  rating int,
  comment text,
  coach_reply text
)
language sql
security definer
stable
set search_path = public
as $$
  select cr.id, cr.checkin_id, cr.created_at, cr.coach_id, coalesce(co.full_name, ''), cr.rating, cr.comment, cr.coach_reply
  from public.coach_ratings cr
  left join public.profiles co on co.id = cr.coach_id
  where cr.client_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.client_get_my_ratings() from public;
grant execute on function public.client_get_my_ratings() to authenticated;

drop function if exists public.manager_get_issues();

create function public.manager_get_issues()
returns table (
  id bigint,
  created_at timestamptz,
  client_id uuid,
  client_name text,
  description text,
  severity public.issue_severity,
  status public.issue_status,
  resolved_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select ir.id, ir.created_at, ir.client_id, coalesce(cl.full_name, ''), ir.description, ir.severity, ir.status, ir.resolved_at
  from public.issue_reports ir
  join public.checkins c on c.id = ir.checkin_id
  join public.sites s on s.site_id = c.site_id
  left join public.profiles cl on cl.id = ir.client_id
  where s.manager_id = (select auth.uid())
  order by ir.created_at desc;
$$;

revoke all on function public.manager_get_issues() from public;
grant execute on function public.manager_get_issues() to authenticated;

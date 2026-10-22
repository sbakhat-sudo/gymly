-- Sprint 2 revisto: "Feedback" diventa una sezione autonoma del Client, non più agganciata al
-- trigger di check-out — il Client sceglie da una lista dei propri check-out recenti su quale
-- lasciare un feedback. Per marcare nella UI quali check-out sono già stati valutati (e bloccare un
-- secondo invio prima ancora di provarci, non solo lato server), `client_get_my_ratings()` deve
-- restituire anche `checkin_id`, non solo i dati della valutazione.
drop function if exists public.client_get_my_ratings();

create function public.client_get_my_ratings()
returns table (
  id bigint,
  checkin_id bigint,
  created_at timestamptz,
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
  select cr.id, cr.checkin_id, cr.created_at, coalesce(co.full_name, ''), cr.rating, cr.comment, cr.coach_reply
  from public.coach_ratings cr
  left join public.profiles co on co.id = cr.coach_id
  where cr.client_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.client_get_my_ratings() from public;
grant execute on function public.client_get_my_ratings() to authenticated;

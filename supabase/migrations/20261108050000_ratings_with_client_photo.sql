-- The Manager's and the Coach's lists of ratings show who left each one: the client's name came back but not their
-- photo, so the list could only draw their initials. Two new functions return the same rows plus the client's photo URL
-- (read inside the function, so the Coach needs no access to client profiles — only the photo of the client who rated
-- them, nothing else). They are added next to the old ones, which stay untouched.
create or replace function public.coach_get_my_ratings_with_photo()
returns table (id bigint, created_at timestamptz, client_name text, rating integer, comment text, coach_reply text, manager_note text, client_avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, cr.created_at, coalesce(cl.full_name, ''), cr.rating, cr.comment, cr.coach_reply, cr.manager_note, cl.avatar_url
  from public.coach_ratings cr
  left join public.profiles cl on cl.id = cr.client_id
  where cr.coach_id = (select auth.uid())
  order by cr.created_at desc;
$$;
revoke all on function public.coach_get_my_ratings_with_photo() from public, anon;
grant execute on function public.coach_get_my_ratings_with_photo() to authenticated;

create or replace function public.manager_get_ratings_with_photo()
returns table (id bigint, created_at timestamptz, client_name text, coach_id uuid, coach_name text, rating integer, comment text, coach_reply text, manager_note text, client_avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, cr.created_at, coalesce(cl.full_name, ''), cr.coach_id, coalesce(co.full_name, ''), cr.rating, cr.comment, cr.coach_reply, cr.manager_note, cl.avatar_url
  from public.coach_ratings cr
  join public.checkins c on c.id = cr.checkin_id
  join public.sites s on s.site_id = c.site_id
  left join public.profiles cl on cl.id = cr.client_id
  left join public.profiles co on co.id = cr.coach_id
  where s.manager_id = (select auth.uid())
  order by cr.created_at desc;
$$;
revoke all on function public.manager_get_ratings_with_photo() from public, anon;
grant execute on function public.manager_get_ratings_with_photo() to authenticated;

notify pgrst, 'reload schema';

-- Admin's queue of Owners waiting for approval: show the gym they asked for and the email they signed up with
-- (until now only the personal name, which a new Owner no longer enters at sign-up). Admin-only, like the other
-- admin_* readers.
create function public.admin_get_pending_owners()
returns table (
  user_id uuid,
  gym_name text,
  full_name text,
  email text,
  requested_plan public.site_plan,
  created_at timestamptz
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
  select p.id, nullif(trim(p.requested_gym_name), ''), p.full_name, au.email::text, p.requested_plan, p.created_at
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.role = 'owner' and p.status = 'pending'
  order by p.created_at;
end;
$$;

revoke all on function public.admin_get_pending_owners() from public, anon;
grant execute on function public.admin_get_pending_owners() to authenticated;

notify pgrst, 'reload schema';

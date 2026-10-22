-- Fix: `profiles_select_site_coaches` (20261027000000) reads the caller's own `site_id` with a
-- subquery against `profiles` itself — and Postgres re-applies every policy on `profiles` to that
-- subquery too, including this same policy, which needs the same subquery again, forever: "infinite
-- recursion detected in policy for relation 'profiles'", live-verified broken before this fix.
--
-- Fix: wrap the self-lookup in a SECURITY DEFINER function. Its internal query runs with the
-- function owner's privileges (bypassing RLS, same as every other SECURITY DEFINER function in this
-- project), so it's a single opaque call from the policy's point of view — never re-triggers the
-- policy that calls it. This is the standard, documented way to avoid this exact class of recursion.
drop policy "profiles_select_site_coaches" on public.profiles;

create or replace function public.my_site_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select site_id from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.my_site_id() from public;
grant execute on function public.my_site_id() to authenticated;

create policy "profiles_select_site_coaches" on public.profiles
  for select to authenticated
  using (
    role = 'coach'
    and status = 'active'
    and site_id = public.my_site_id()
  );

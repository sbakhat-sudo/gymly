-- The signup screen lets every role search gyms by name BEFORE the account exists (anon), so a
-- new member/coach can pick theirs in the same step as entering email/password. `sites` itself
-- stays "select to authenticated" only (it also holds capacity_reference and other operational
-- fields that must never reach an unauthenticated client) — this adds a narrow, SECURITY DEFINER
-- function that returns just the 3 columns a directory listing needs.

create or replace function public.list_signup_sites()
returns table (site_id text, name text, address text)
language sql
security definer
set search_path = public
stable
as $$
  select site_id, name, address from public.sites order by name;
$$;

revoke all on function public.list_signup_sites() from public;
grant execute on function public.list_signup_sites() to anon, authenticated;

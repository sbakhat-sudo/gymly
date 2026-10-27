-- Signed-out visitors (role `anon`) could call almost every SECURITY DEFINER function through the API.
-- Each function already refuses callers who are not the right role, but there is no reason to expose them at all:
-- take EXECUTE away from `anon` everywhere except the few functions a not-yet-signed-in person really needs
-- (the sign-up site list, invite lookup, and the helpers that row-level-security policies call).
-- Also pins the search_path of owner_set_hq, the one function that had none.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in ('list_signup_sites', 'get_invite_info', 'is_admin', 'is_owner', 'my_site_id')
      and p.proname not like 'st\_%'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;

alter function public.owner_set_hq(text, double precision, double precision) set search_path = public;

notify pgrst, 'reload schema';

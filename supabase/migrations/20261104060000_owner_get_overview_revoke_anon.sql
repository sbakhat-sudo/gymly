-- owner_get_overview() was executable by `anon` (Supabase grants EXECUTE on every new function to anon and
-- authenticated by default, and `revoke ... from public` alone doesn't remove those). It never returned
-- anything to an anonymous caller — it raises 'not authorized' unless the caller is an Owner — but there is
-- no reason for the endpoint to be reachable without signing in at all.
revoke execute on function public.owner_get_overview() from anon;

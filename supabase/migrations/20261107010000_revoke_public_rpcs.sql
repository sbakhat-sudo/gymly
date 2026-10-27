-- Follow-up to 20261107000000: a few functions were open to signed-out visitors through the default PUBLIC grant,
-- not a direct grant to `anon`, so revoking from `anon` alone did not close them. Close PUBLIC and keep signed-in access.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('check_in', 'get_daily_bands', 'get_live_band', 'get_week_real_bands', 'get_weekly_stats', 'handle_new_user', 'owner_create_manager_record')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.sig::text not like 'handle_new_user%' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

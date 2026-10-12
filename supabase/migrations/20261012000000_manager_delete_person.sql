-- Lets a Manager permanently remove a Coach/Client from their own roster ("Elimina account" in
-- PeopleScreen) — distinct from the existing deactivate/reactivate toggle, which just flips
-- `status` and keeps the row (and their check-in/points history) around. Mirrors
-- `manager_set_person_name`'s exact authorization shape, and `admin_delete_manager`'s exact
-- deletion shape: removes the `profiles` row only. Their `auth.users` row survives (deleting that
-- needs service_role, which this app never holds), so signing in again resolves to 'noProfile'
-- (auth-context.tsx) — the same dead end as mid-signup, not a full account purge.
create or replace function public.manager_delete_person(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_target_site text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;

  select site_id into v_target_site
  from public.profiles
  where id = p_user_id and role in ('coach', 'client');

  if v_target_site is null then
    raise exception 'profile not found';
  end if;

  if not exists (select 1 from public.sites where site_id = v_target_site and manager_id = v_manager) then
    raise exception 'not authorized';
  end if;

  delete from public.profiles where id = p_user_id;
end;
$$;

revoke all on function public.manager_delete_person(uuid) from public;
grant execute on function public.manager_delete_person(uuid) to authenticated;

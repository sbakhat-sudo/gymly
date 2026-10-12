-- Lets a Manager rename a Coach/Client in their own roster (PeopleScreen's "modifica" button).
-- Mirrors `set_profile_status`'s exact authorization shape: the caller must be the MANAGER of the
-- target profile's site, and the target must be a coach/client — a manager can never rename another
-- manager, an admin, or anyone outside their own gym.
create or replace function public.manager_set_person_name(p_user_id uuid, p_full_name text)
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

  update public.profiles set full_name = nullif(trim(p_full_name), '') where id = p_user_id;
end;
$$;

revoke all on function public.manager_set_person_name(uuid, text) from public;
grant execute on function public.manager_set_person_name(uuid, text) to authenticated;

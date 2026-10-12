-- Lets a Manager fully provision a Coach/Client on their behalf: the app signs the new person up
-- with a throwaway auth session (only the real user can set their own password — Supabase doesn't
-- allow anyone else to do that without service_role, which this app never holds) and then calls
-- this function, as the MANAGER, to finish attaching the profile. The new member is active
-- immediately — no "Richieste" wait, same as being pre-approved.
create or replace function public.manager_create_member(p_user_id uuid, p_role public.user_role, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_site_id text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('coach', 'client') then
    raise exception 'invalid role';
  end if;

  select site_id into v_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile already exists';
  end if;

  insert into public.profiles (id, role, site_id, status, full_name)
  values (p_user_id, p_role, v_site_id, 'active', nullif(trim(coalesce(p_full_name, '')), ''));
end;
$$;

revoke all on function public.manager_create_member(uuid, public.user_role, text) from public;
grant execute on function public.manager_create_member(uuid, public.user_role, text) to authenticated;

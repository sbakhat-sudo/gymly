-- Fix: `manager_create_member` sets status = 'active' directly (it never calls
-- `set_profile_status`, the only place that was stamping `activated_at`), so every person added
-- through "Aggiungi Coach/Cliente" had a real activation date missing in PeopleScreen's new column.
create or replace function public.manager_create_member(p_user_id uuid, p_role public.user_role, p_full_name text, p_phone text default null)
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
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  update public.profiles
  set role = p_role,
      site_id = v_site_id,
      status = 'active',
      activated_at = now(),
      full_name = nullif(trim(coalesce(p_full_name, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = p_user_id;
end;
$$;

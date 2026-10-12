-- Admin's reach is tightened to Manager accounts only — never coach or client directly (those are
-- each gym's own Manager's responsibility). Replaces the two functions and the SELECT policy from
-- the previous migration with a manager-only version; nothing else changes.

create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'manager') then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;
end;
$$;

create or replace function public.admin_set_profile_name(p_user_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'manager') then
    raise exception 'profile not found';
  end if;

  update public.profiles set full_name = nullif(trim(p_full_name), '') where id = p_user_id;
end;
$$;

drop policy "profiles_select_by_admin" on public.profiles;

create policy "profiles_select_by_admin" on public.profiles
  for select to authenticated using (public.is_admin() and role = 'manager');

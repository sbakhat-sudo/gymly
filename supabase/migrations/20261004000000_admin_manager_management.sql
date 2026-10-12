-- Admin "Gestione Manager": rename any profile, and reassign a gym to a different manager account.
-- Both SECURITY DEFINER, is_admin() checked inside, same pattern as the other admin_* functions.

-- Admin can fix a typo'd name, or set one for an account that never filled it in — for any role,
-- not just managers, since the same action is useful from the Persone screen too.
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
  if not exists (select 1 from public.profiles where id = p_user_id and role in ('manager', 'coach', 'client')) then
    raise exception 'profile not found';
  end if;

  update public.profiles set full_name = nullif(trim(p_full_name), '') where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_profile_name(uuid, text) from public;
grant execute on function public.admin_set_profile_name(uuid, text) to authenticated;

-- Transfers an existing gym to a different, already-active manager account (ownership handoff).
-- This never creates a manager account — the only way one is created is self-registration via
-- create_manager_site(); this just moves which existing manager a gym belongs to.
create or replace function public.admin_reassign_site_manager(p_site_id text, p_new_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where id = p_new_manager_id and role = 'manager' and status = 'active') then
    raise exception 'target is not an active manager';
  end if;

  update public.sites set manager_id = p_new_manager_id where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;
end;
$$;

revoke all on function public.admin_reassign_site_manager(text, uuid) from public;
grant execute on function public.admin_reassign_site_manager(text, uuid) to authenticated;

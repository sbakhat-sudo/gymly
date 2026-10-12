-- "Elimina" on a manager: removes their profiles row, which (a) wipes them from every Admin list
-- immediately and (b) locks them out — signing in again resolves to 'noProfile' (auth-context.tsx),
-- same dead end as mid-signup. Their auth.users row survives (deleting that needs service_role,
-- which this app never holds), so this isn't a full account purge, only Gymly access being removed.
-- Their gym keeps its manager_id pointing at that now-profileless account; reassign it to someone
-- else first via "Riassegna manager" if it should keep operating.
create or replace function public.admin_delete_manager(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.profiles where id = p_user_id and role = 'manager';
  if not found then
    raise exception 'profile not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_manager(uuid) from public;
grant execute on function public.admin_delete_manager(uuid) to authenticated;

-- Tracks when a Coach/Client profile was first activated and, if currently deactivated, when that
-- happened — the Manager's "Persone" list shows these dates per person (PeopleScreen.tsx).
alter table public.profiles add column if not exists activated_at timestamptz;
alter table public.profiles add column if not exists deactivated_at timestamptz;

-- Best-effort backfill for rows that predate these columns: `created_at` is the closest thing to a
-- real activation date already on file for anyone currently active.
update public.profiles set activated_at = created_at where status = 'active' and activated_at is null;

-- Same function as before (see 20260929000000_roles_and_backend.sql), now also stamping
-- `activated_at` (kept on every re-approval via coalesce — it's the FIRST activation date, never
-- overwritten) and `deactivated_at` (always refreshed to the latest deactivation).
create or replace function public.set_profile_status(p_user_id uuid, p_status public.profile_status)
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
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
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

  update public.profiles
  set status = p_status,
      activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end,
      deactivated_at = case when p_status = 'rejected' then now() else deactivated_at end
  where id = p_user_id;
end;
$$;

revoke all on function public.set_profile_status(uuid, public.profile_status) from public;
grant execute on function public.set_profile_status(uuid, public.profile_status) to authenticated;

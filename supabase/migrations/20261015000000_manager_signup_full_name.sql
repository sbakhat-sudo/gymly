-- Bug: the "Nome e cognome" field collected on ManagerSignupScreen was never sent to
-- request_manager_signup() (it only ever took p_plan) — every new Manager's profiles.full_name
-- stayed null, showing as "Senza nome" in the Admin's Manager tab, the Palestre "Gestita da" line,
-- the CSV export, and leaving Impostazioni -> Profilo's Nome/Cognome fields blank.
--
-- full_name is the single display name used everywhere above (admin-api.ts, AdminSitesScreen,
-- csv-export.ts). first_name/last_name are a SEPARATE pair of columns (see
-- 20260930010000_profile_details.sql) that only ProfileSection.tsx ("Impostazioni -> Profilo")
-- reads/writes — a Manager signup only ever collects one combined field, so this function splits it
-- on the first space (web/app convention: text before the first space is the given name, the rest
-- the family name) to populate both representations from the one input, instead of leaving
-- first_name/last_name null and only fixing full_name.
create or replace function public.request_manager_signup(p_plan public.site_plan, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text := nullif(trim(p_full_name), '');
  v_space_pos int;
  v_first_name text;
  v_last_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  if v_full_name is not null then
    v_space_pos := position(' ' in v_full_name);
    if v_space_pos > 0 then
      v_first_name := left(v_full_name, v_space_pos - 1);
      v_last_name := nullif(trim(substring(v_full_name from v_space_pos + 1)), '');
    else
      v_first_name := v_full_name;
      v_last_name := null;
    end if;
  end if;

  insert into public.profiles (id, role, site_id, status, requested_plan, full_name, first_name, last_name)
  values (v_uid, 'manager', null, 'pending', p_plan, v_full_name, v_first_name, v_last_name);
end;
$$;

revoke all on function public.request_manager_signup(public.site_plan, text) from public;
grant execute on function public.request_manager_signup(public.site_plan, text) to authenticated;

-- The old one-argument signature is gone: PostgREST would otherwise keep both overloads reachable
-- and the schema cache could resolve a stale client call to the version that drops the name again.
drop function if exists public.request_manager_signup(public.site_plan);

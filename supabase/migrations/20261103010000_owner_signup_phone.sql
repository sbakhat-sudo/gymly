-- Owner self-signup now also collects a phone number (same field Coach/Client's RoleAndSiteForm and
-- owner_create_manager_record already store on profiles.phone) — the signup form asks for it, so it
-- needs to actually reach the row. Dropped and recreated (not `create or replace`) because adding a
-- parameter changes the function's signature; the old two-arg overload is removed so callers can't
-- silently keep hitting a version that drops the phone on the floor.
drop function if exists public.request_owner_signup(public.site_plan, text);

create function public.request_owner_signup(p_plan public.site_plan, p_full_name text, p_phone text default null)
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
  if not exists (select 1 from public.profiles where id = v_uid and role = 'unclaimed') then
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

  update public.profiles
  set role = 'owner', chain_id = null, status = 'pending', requested_plan = p_plan,
      full_name = v_full_name, first_name = v_first_name, last_name = v_last_name,
      phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = v_uid;
end;
$$;

revoke all on function public.request_owner_signup(public.site_plan, text, text) from public;
grant execute on function public.request_owner_signup(public.site_plan, text, text) to authenticated;

-- A Client the Manager added has no address of their own: their address in the first-login profile is the gym's own
-- (the one set when the Manager was added), not something they choose — same as a Coach. The database ignores whatever
-- address such a Client sends and stores the gym's. A Client who signed up on their own already gave their exact
-- address at sign-up, so theirs stays and can be corrected. If the gym has no address saved, the typed one is used.
create or replace function public.complete_my_profile(
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_home_address text,
  p_gym_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_site text;
  v_current_address text;
  v_first text := nullif(trim(p_first_name), '');
  v_last text := nullif(trim(p_last_name), '');
  v_address text := nullif(trim(p_home_address), '');
  v_gym text := nullif(trim(coalesce(p_gym_name, '')), '');
  v_gym_address text;
begin
  select role, site_id, nullif(trim(home_address), '') into v_role, v_site, v_current_address from public.profiles
  where id = auth.uid() and status = 'active' and role in ('owner', 'manager', 'coach', 'client');
  if v_role is null then
    raise exception 'not authorized';
  end if;

  if v_site is not null and (v_role = 'coach' or (v_role = 'client' and v_current_address is null)) then
    select nullif(trim(address), '') into v_gym_address from public.sites where site_id = v_site;
    if v_gym_address is not null then
      v_address := v_gym_address;
    end if;
  end if;

  if v_first is null or v_last is null or v_address is null or p_birth_date is null then
    raise exception 'missing fields';
  end if;
  if char_length(v_first) > 80 or char_length(v_last) > 80 or char_length(v_address) > 200 then
    raise exception 'value too long';
  end if;
  if p_birth_date < date '1900-01-01' or p_birth_date > (current_date - interval '16 years')::date then
    raise exception 'invalid birth date';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and avatar_url is not null) then
    raise exception 'photo required';
  end if;

  if v_role = 'owner' then
    if v_gym is null then
      raise exception 'gym name required';
    end if;
    if char_length(v_gym) > 120 then
      raise exception 'value too long';
    end if;
    update public.gym_chains set name = v_gym where owner_id = auth.uid();
    update public.sites set name = v_gym where chain_id in (select id from public.gym_chains where owner_id = auth.uid());
  end if;

  update public.profiles
  set first_name = v_first,
      last_name = v_last,
      full_name = v_first || ' ' || v_last,
      birth_date = p_birth_date,
      birth_year = extract(year from p_birth_date)::int,
      home_address = v_address,
      profile_completed_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.complete_my_profile(text, text, date, text, text) from public, anon;
grant execute on function public.complete_my_profile(text, text, date, text, text) to authenticated;

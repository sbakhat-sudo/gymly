-- One gym name, set once by the Owner and then fixed for everyone under them.
--
--  * The Owner types the real name of the gym in their mandatory first-login profile
--    (complete_my_profile() below) — until then the business carries the placeholder the approval
--    step gave it (the Owner's own name).
--  * Every Manager the Owner adds gets a site with exactly that name. The "Aggiungi Manager" form
--    shows it locked, and the database enforces it too: owner_create_manager_record() ignores the
--    name it is handed and uses the chain's own, so a hand-made request can't invent another one.
--  * Managers, Coaches and Clients see that name read-only in their profile.

-- ── Managers always get the chain's name ──────────────────────────────────────────────────────────
create or replace function public.owner_create_manager_record(
  p_manager_user_id uuid,
  p_full_name text,
  p_site_name text,
  p_address text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_phone text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_chain_plan public.site_plan;
  v_chain_name text;
  v_default_capacity int;
  v_site_id text;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;

  select plan, name into v_chain_plan, v_chain_name from public.gym_chains where id = v_chain;
  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;
  v_default_capacity := coalesce(v_default_capacity, 50);

  if not exists (select 1 from public.profiles where id = p_manager_user_id and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  update public.profiles set role = 'manager', status = 'active', full_name = p_full_name, phone = nullif(trim(coalesce(p_phone, '')), '') where id = p_manager_user_id;

  v_site_id := 'st_' || substr(md5(p_manager_user_id::text || clock_timestamp()::text), 1, 12);

  -- `p_site_name` is only kept so the Edge Function's call signature doesn't change: the name is always the chain's.
  insert into public.sites (
    site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan,
    band_green_pct, band_amber_pct, chain_id, location
  )
  values (
    v_site_id, v_chain_name, p_address, 'Europe/Rome', p_manager_user_id, 'active', v_default_capacity, coalesce(v_chain_plan, 'trial'),
    40, 75, v_chain,
    case when p_lat is not null and p_lng is not null then ST_MakePoint(p_lng, p_lat)::geography else null end
  );

  update public.profiles set site_id = v_site_id where id = p_manager_user_id;

  return v_site_id;
end;
$$;

-- ── The Owner's first-login profile now also carries the gym's name ──────────────────────────────
-- New trailing parameter, so the old 4-argument version has to go first (two overloads where one is a
-- prefix of the other with a default would make every call ambiguous).
drop function if exists public.complete_my_profile(text, text, date, text);

create function public.complete_my_profile(
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
  v_first text := nullif(trim(p_first_name), '');
  v_last text := nullif(trim(p_last_name), '');
  v_address text := nullif(trim(p_home_address), '');
  v_gym text := nullif(trim(coalesce(p_gym_name, '')), '');
begin
  select role into v_role from public.profiles
  where id = auth.uid() and status = 'active' and role in ('owner', 'manager', 'coach');
  if v_role is null then
    raise exception 'not authorized';
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

  -- Only the Owner names the gym; for everyone else it is already fixed and not theirs to change.
  if v_role = 'owner' then
    if v_gym is null then
      raise exception 'gym name required';
    end if;
    if char_length(v_gym) > 120 then
      raise exception 'value too long';
    end if;
    update public.gym_chains set name = v_gym where owner_id = auth.uid();
    -- Sites the Owner already has take the new name too — one name for the whole chain.
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

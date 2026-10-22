-- Owner ("Titolare") self-signup: picks a Gymly SaaS plan (same trial/pro/business tiers Manager
-- used to pick), waits for Admin approval, then creates their own business (a gym_chains row) —
-- exact same lifecycle Manager's self-signup already had (request_* -> pending -> Admin approves ->
-- create_*), just retargeted to 'owner'. Manager no longer self-registers at all from this point on
-- (confirmed product decision) — it's only ever created by an Owner via owner_create_manager_record,
-- which already exists and already makes the new Manager active immediately, no approval queue.

-- `chain_id` plays the exact same role for Owner that `site_id` already plays for Manager: "this
-- role-holder hasn't created their own thing yet" is told apart from everything else by this being
-- null, not by a separate status.
alter table public.profiles add column chain_id uuid references public.gym_chains(id);

-- The Owner's ONE SaaS plan for their whole business (not per-site) — every site a Manager-child of
-- this Owner ever gets (via owner_create_manager_record) inherits this, instead of the hardcoded
-- 'trial' it used before this migration.
alter table public.gym_chains add column plan public.site_plan not null default 'trial';

-- ── request_owner_signup() — same shape as request_manager_signup(), role='owner' ──────────────────
create function public.request_owner_signup(p_plan public.site_plan, p_full_name text)
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
      full_name = v_full_name, first_name = v_first_name, last_name = v_last_name
  where id = v_uid;
end;
$$;

revoke all on function public.request_owner_signup(public.site_plan, text) from public;
grant execute on function public.request_owner_signup(public.site_plan, text) to authenticated;

-- ── create_owner_chain() — Owner's own post-approval "create my business" step ─────────────────────
create function public.create_owner_chain(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.site_plan;
  v_chain_id uuid;
begin
  select requested_plan into v_plan
  from public.profiles
  where id = v_uid and role = 'owner' and status = 'active' and chain_id is null;
  if not found then
    raise exception 'not an approved owner awaiting a business';
  end if;

  insert into public.gym_chains (name, owner_id, plan)
  values (p_name, v_uid, coalesce(v_plan, 'trial'))
  returning id into v_chain_id;

  update public.profiles set chain_id = v_chain_id where id = v_uid;

  return v_chain_id;
end;
$$;

revoke all on function public.create_owner_chain(text) from public;
grant execute on function public.create_owner_chain(text) to authenticated;

-- ── admin_set_profile_status() — now approves Owners, not Managers (product decision) ──────────────
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_owner_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;

  select full_name into v_owner_name from public.profiles where id = p_user_id and role = 'owner';
  if not found then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label)
  values (v_admin, case p_status when 'active' then 'owner_activated' else 'owner_deactivated' end, 'owner', p_user_id::text, v_owner_name);
end;
$$;

-- ── owner_create_manager_record() — new Manager's site now inherits the Owner's own chosen plan ────
create or replace function public.owner_create_manager_record(
  p_manager_user_id uuid,
  p_full_name text,
  p_site_name text,
  p_address text,
  p_lat float8 default null,
  p_lng float8 default null,
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
  v_default_capacity int;
  v_site_id text;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;

  select plan into v_chain_plan from public.gym_chains where id = v_chain;
  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;
  v_default_capacity := coalesce(v_default_capacity, 50);

  if not exists (select 1 from public.profiles where id = p_manager_user_id and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  update public.profiles set role = 'manager', status = 'active', full_name = p_full_name, phone = nullif(trim(coalesce(p_phone, '')), '') where id = p_manager_user_id;

  v_site_id := 'st_' || substr(md5(p_manager_user_id::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (
    site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan,
    band_green_pct, band_amber_pct, chain_id, location
  )
  values (
    v_site_id, p_site_name, p_address, 'Europe/Rome', p_manager_user_id, 'active', v_default_capacity, coalesce(v_chain_plan, 'trial'),
    40, 75, v_chain,
    case when p_lat is not null and p_lng is not null then ST_MakePoint(p_lng, p_lat)::geography else null end
  );

  update public.profiles set site_id = v_site_id where id = p_manager_user_id;

  return v_site_id;
end;
$$;

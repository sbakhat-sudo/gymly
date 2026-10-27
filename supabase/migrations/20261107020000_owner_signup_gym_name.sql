-- The Owner's sign-up now asks only for the gym name; their own first/last name is entered after the first sign-in
-- (welcome screen). Until now the one "Nome e cognome" field was also the gym's provisional name, so people who typed
-- the gym there saw it come back as their own first name.

alter table public.profiles add column if not exists requested_gym_name text;

drop function if exists public.request_owner_signup(public.site_plan, text, text);

create function public.request_owner_signup(p_plan public.site_plan, p_full_name text, p_phone text default null, p_gym_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text := nullif(trim(p_full_name), '');
  v_gym text := nullif(trim(coalesce(p_gym_name, '')), '');
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
  if v_gym is not null and char_length(v_gym) > 120 then
    raise exception 'value too long';
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
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      requested_gym_name = v_gym
  where id = v_uid;
end;
$$;

revoke all on function public.request_owner_signup(public.site_plan, text, text, text) from public, anon;
grant execute on function public.request_owner_signup(public.site_plan, text, text, text) to authenticated;

-- Approving the Owner creates the business: it now carries the gym name they asked for (their own name only when
-- none was given, as before).
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_owner_name text;
  v_gym_name text;
  v_plan public.site_plan;
  v_chain_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;

  select full_name, requested_gym_name, requested_plan into v_owner_name, v_gym_name, v_plan from public.profiles where id = p_user_id and role = 'owner';
  if not found then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  if p_status = 'active' then
    select id into v_chain_id from public.gym_chains where owner_id = p_user_id;
    if v_chain_id is null then
      insert into public.gym_chains (name, owner_id, plan)
      values (coalesce(nullif(trim(v_gym_name), ''), nullif(trim(v_owner_name), ''), 'La mia attività'), p_user_id, coalesce(v_plan, 'trial'))
      returning id into v_chain_id;
    end if;
    update public.profiles set chain_id = v_chain_id where id = p_user_id;
  end if;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label)
  values (v_admin, case p_status when 'active' then 'owner_activated' else 'owner_deactivated' end, 'owner', p_user_id::text, coalesce(v_owner_name, v_gym_name));
end;
$$;

notify pgrst, 'reload schema';

-- Bug: 9 rows exist in auth.users with no matching row in public.profiles — every signup path
-- (self-registration, Manager-created members, Manager signup, invite redemption) creates the
-- auth.users row first via auth.signUp(), then attaches role/site_id in a SEPARATE follow-up call
-- (request_manager_signup / manager_create_member / a raw INSERT / redeem_invite). Anything that
-- interrupts that second step — email confirmation never completed, the app closed between the two
-- calls, a dropped network request — leaves a permanently orphaned auth user with no profile at all.
--
-- Fix: a trigger on auth.users makes row creation atomic with signup, full stop. It inserts a
-- placeholder row with a new role value, 'unclaimed', meaning "this auth user exists but hasn't
-- picked role/site yet" — never a real role. Every one of the four places that used to INSERT a
-- finished profile now UPDATEs this placeholder instead (only when it's still unclaimed, so a
-- second attempt can never silently overwrite an already-completed profile). The app itself never
-- needs to know this placeholder exists: auth-context.tsx's fetchProfile() treats an 'unclaimed' row
-- exactly like "no row at all", so every existing noProfile/pending/active code path is unchanged.

alter type public.user_role add value 'unclaimed';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, status)
  values (new.id, 'unclaimed', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- No longer needed: the trigger above is now the ONLY thing that ever inserts a profiles row —
-- every signup-completion path below UPDATEs the placeholder it already created. A raw client
-- INSERT would now always fail anyway (duplicate id), so remove the policy that used to allow it.
drop policy if exists "profiles_insert_self" on public.profiles;

-- ── The four places that used to INSERT a finished profile now UPDATE the 'unclaimed' placeholder ──

-- 1) Coach/Client self-registration (RoleAndSiteForm.tsx): used to be a raw client-side INSERT under
-- profiles_insert_self (just dropped above) — now an RPC, same shape as the other three signup paths,
-- and using auth.uid() instead of a client-passed id (never trust an id the caller hands you).
create or replace function public.complete_self_registration(p_role public.user_role, p_site_id text, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('coach', 'client') then
    raise exception 'invalid role';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  update public.profiles
  set role = p_role, site_id = p_site_id, status = 'pending', full_name = nullif(trim(coalesce(p_full_name, '')), '')
  where id = v_uid;
end;
$$;

revoke all on function public.complete_self_registration(public.user_role, text, text) from public;
grant execute on function public.complete_self_registration(public.user_role, text, text) to authenticated;

-- 2) Manager self-registration — same body as 20261015000000_manager_signup_full_name.sql, INSERT -> UPDATE.
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
  set role = 'manager', site_id = null, status = 'pending', requested_plan = p_plan,
      full_name = v_full_name, first_name = v_first_name, last_name = v_last_name
  where id = v_uid;
end;
$$;

-- 3) Manager-created Coach/Client (Bug 7) — same body as 20261005020000, INSERT -> UPDATE.
create or replace function public.manager_create_member(p_user_id uuid, p_role public.user_role, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_site_id text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('coach', 'client') then
    raise exception 'invalid role';
  end if;

  select site_id into v_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  update public.profiles
  set role = p_role, site_id = v_site_id, status = 'active', full_name = nullif(trim(coalesce(p_full_name, '')), '')
  where id = p_user_id;
end;
$$;

-- 4) Invite redemption (Bug 2) — same body as 20261005010000, INSERT -> UPDATE.
create or replace function public.redeem_invite(p_code text, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  select * into v_invite from public.invites where code = p_code and used_at is null for update;
  if not found then
    raise exception 'invite not found or already used';
  end if;

  update public.profiles
  set role = v_invite.role, site_id = v_invite.site_id, status = 'active',
      full_name = nullif(trim(coalesce(p_full_name, v_invite.full_name, '')), '')
  where id = v_uid;

  update public.invites set used_at = now(), used_by = v_uid where code = p_code;
end;
$$;

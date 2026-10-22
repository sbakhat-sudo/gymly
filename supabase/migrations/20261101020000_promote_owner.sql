-- Promotes ONE existing Supabase Auth account to Owner ("Titolare"), and creates the gym_chains row
-- it owns. Same bootstrap pattern as 20261003020000_promote_admin.sql — there is no sign-up screen
-- for this role, by design: Gymly itself provisions an Owner account for a paying chain business.
--
-- Before running: sign in to the app at least once with the account you want as Owner (any role is
-- fine — this overwrites it), so its row in auth.users exists. Replace the email and chain name
-- below with the real ones, then run this file.

do $$
declare
  v_email text := 'owner@gymly.test';       -- replace with the real account's email
  v_chain_name text := 'La Mia Catena';     -- replace with the real business name
  v_uid uuid;
  v_chain_id uuid;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise exception 'no auth.users row for %, sign in with that account first', v_email;
  end if;

  insert into public.gym_chains (name, owner_id) values (v_chain_name, v_uid)
  returning id into v_chain_id;

  insert into public.profiles (id, role, status, full_name)
  values (v_uid, 'owner', 'active', v_chain_name)
  on conflict (id) do update set role = 'owner', status = 'active', site_id = null;
end $$;

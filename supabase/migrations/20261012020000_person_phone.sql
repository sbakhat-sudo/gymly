-- Stores the phone number a Manager already collects (today only used transiently to build the
-- WhatsApp invite link, then thrown away) so it can show up as its own column in "Persone"
-- (PeopleScreen.tsx) and in the CSV export.
alter table public.profiles add column if not exists phone text;

-- Same body as 20261017000000's manager_create_member, plus `p_phone`. A 4th parameter is a
-- different signature, not a replacement of the 3-arg version — `create or replace` would leave
-- both overloaded side by side, so the old one is dropped first.
drop function if exists public.manager_create_member(uuid, public.user_role, text);

create or replace function public.manager_create_member(p_user_id uuid, p_role public.user_role, p_full_name text, p_phone text default null)
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
  set role = p_role,
      site_id = v_site_id,
      status = 'active',
      full_name = nullif(trim(coalesce(p_full_name, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = p_user_id;
end;
$$;

revoke all on function public.manager_create_member(uuid, public.user_role, text, text) from public;
grant execute on function public.manager_create_member(uuid, public.user_role, text, text) to authenticated;

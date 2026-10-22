-- Adds a phone number field to the Client/Coach self-registration screen (signup.tsx's
-- RoleAndSiteForm) — same `profiles.phone` column already used for a Manager-added person.
-- A 4th parameter is a different signature, not a replacement of the 3-arg version —
-- `create or replace` would leave both overloaded side by side, so the old one is dropped first.
drop function if exists public.complete_self_registration(public.user_role, text, text);

create or replace function public.complete_self_registration(p_role public.user_role, p_site_id text, p_full_name text, p_phone text default null)
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
  set role = p_role,
      site_id = p_site_id,
      status = 'pending',
      full_name = nullif(trim(coalesce(p_full_name, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = v_uid;
end;
$$;

revoke all on function public.complete_self_registration(public.user_role, text, text, text) from public;
grant execute on function public.complete_self_registration(public.user_role, text, text, text) to authenticated;

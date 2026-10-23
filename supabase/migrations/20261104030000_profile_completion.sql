-- Mandatory first-login profile for staff accounts (Owner, Manager, Coach): the first time someone
-- enters after being approved (or, for a Manager an Owner created by hand, after their first sign-in)
-- a popup asks for photo, first/last name, birth date, home address and a password of their own.
-- This adds the two missing fields and the marker that says "this person already did it".

alter table public.profiles
  add column birth_date date,
  add column home_address text,
  add column profile_completed_at timestamptz;

-- Everyone already inside keeps going straight in: only accounts that become active after this
-- migration (still-pending Owners/Coaches, Managers created from now on) ever see the popup.
update public.profiles set profile_completed_at = now() where status = 'active';

-- ── Save the completed profile ────────────────────────────────────────────────────────────────────
-- A function instead of a direct UPDATE on purpose: `profile_completed_at` must only ever be set
-- together with every required field really being there (the column-level grants that let a user
-- edit their own name deliberately don't include it), and the photo has to exist already — it is
-- uploaded first through the normal avatar flow, which sets `avatar_url`.
create function public.complete_my_profile(
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_home_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(trim(p_first_name), '');
  v_last text := nullif(trim(p_last_name), '');
  v_address text := nullif(trim(p_home_address), '');
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('owner', 'manager', 'coach')
  ) then
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

  update public.profiles
  set first_name = v_first,
      last_name = v_last,
      -- full_name is what every roster screen reads (see ProfileSection) — keep it in step.
      full_name = v_first || ' ' || v_last,
      birth_date = p_birth_date,
      birth_year = extract(year from p_birth_date)::int,
      home_address = v_address,
      profile_completed_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.complete_my_profile(text, text, date, text) from public, anon;
grant execute on function public.complete_my_profile(text, text, date, text) to authenticated;

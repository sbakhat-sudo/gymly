-- A member who signs up on their own now gives their exact address with the request, so the Manager sees where
-- they live when deciding whether to approve. Required for a Client (a Coach arrives through the Manager's own QR
-- link and gets the gym's address instead). The old 4-argument version goes first, so the two never overlap.
drop function if exists public.complete_self_registration(public.user_role, text, text, text);

create function public.complete_self_registration(
  p_role public.user_role,
  p_site_id text,
  p_full_name text,
  p_phone text default null,
  p_home_address text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_address text := nullif(trim(coalesce(p_home_address, '')), '');
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
  if v_address is not null and char_length(v_address) > 200 then
    raise exception 'value too long';
  end if;
  if p_role = 'client' and (v_address is null or char_length(v_address) < 5) then
    raise exception 'address required';
  end if;

  update public.profiles
  set role = p_role,
      site_id = p_site_id,
      status = 'pending',
      full_name = nullif(trim(coalesce(p_full_name, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      home_address = v_address
  where id = v_uid;
end;
$$;

revoke all on function public.complete_self_registration(public.user_role, text, text, text, text) from public, anon;
grant execute on function public.complete_self_registration(public.user_role, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

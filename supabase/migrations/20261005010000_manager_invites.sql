-- Manager-issued invites: a Manager pre-authorizes a specific Coach/Client (name optional) and
-- shares the resulting link. Signing up through it skips the "Richieste" approval queue entirely —
-- the Manager already vouched for them. Plain self-registration (no invite) is unchanged: it still
-- lands as 'pending' and waits in "Richieste" for the Manager to approve or reject.
create table public.invites (
  code text primary key,
  site_id text not null references public.sites(site_id),
  manager_id uuid not null references auth.users(id),
  role public.user_role not null,
  full_name text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id),
  constraint invites_role_check check (role in ('coach', 'client'))
);

alter table public.invites enable row level security;

create policy "invites_select_own" on public.invites
  for select to authenticated
  using (manager_id = (select auth.uid()));

-- No direct INSERT/UPDATE policy: both go through the SECURITY DEFINER functions below, which
-- re-check the caller is really a manager of the site before touching the table.

-- Open to anon too: a not-yet-registered Coach/Client needs to read the invite's role/gym before
-- an account exists. Only these four non-sensitive fields are ever exposed.
create or replace function public.get_invite_info(p_code text)
returns table (site_id text, site_name text, role public.user_role, full_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select i.site_id, s.name, i.role, i.full_name
  from public.invites i
  join public.sites s on s.site_id = i.site_id
  where i.code = p_code and i.used_at is null;
end;
$$;

revoke all on function public.get_invite_info(text) from public;
grant execute on function public.get_invite_info(text) to anon, authenticated;

create or replace function public.create_invite(p_role public.user_role, p_full_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('coach', 'client') then
    raise exception 'invalid role';
  end if;
  select site_id into v_site_id from public.profiles where id = v_uid and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;

  v_code := substr(md5(v_uid::text || clock_timestamp()::text || random()::text), 1, 10);
  insert into public.invites (code, site_id, manager_id, role, full_name)
  values (v_code, v_site_id, v_uid, p_role, nullif(trim(coalesce(p_full_name, '')), ''));
  return v_code;
end;
$$;

revoke all on function public.create_invite(public.user_role, text) from public;
grant execute on function public.create_invite(public.user_role, text) to authenticated;

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
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  select * into v_invite from public.invites where code = p_code and used_at is null for update;
  if not found then
    raise exception 'invite not found or already used';
  end if;

  insert into public.profiles (id, role, site_id, status, full_name)
  values (v_uid, v_invite.role, v_invite.site_id, 'active', nullif(trim(coalesce(p_full_name, v_invite.full_name, '')), ''));

  update public.invites set used_at = now(), used_by = v_uid where code = p_code;
end;
$$;

revoke all on function public.redeem_invite(text, text) from public;
grant execute on function public.redeem_invite(text, text) to authenticated;

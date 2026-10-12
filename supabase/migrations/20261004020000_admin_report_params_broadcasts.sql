-- Three more Admin pieces, all real (no fabricated data):
--   Report        — platform-wide check-in counts, aggregate only, never a per-person number.
--   Parametri     — one real, wired setting (default capacity for brand-new gyms); not a pile of
--                   decorative toggles that do nothing, since this project never fakes a control.
--   Comunicazioni — in-app only (push does not work in Expo Go), Admin → Manager only, matching
--                   "Admin gestisce solo manager" — never reaches coach or client.

-- ── Report ────────────────────────────────────────────────────────────────
create or replace function public.admin_get_checkins_by_day(p_days int default 14)
returns table (date_key date, count int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select d::date, count(c.id)::int
  from generate_series(current_date - (greatest(p_days, 1) - 1), current_date, '1 day'::interval) d
  left join public.checkins c on c.checkin_at::date = d::date
  group by d
  order by d;
end;
$$;

revoke all on function public.admin_get_checkins_by_day(int) from public;
grant execute on function public.admin_get_checkins_by_day(int) to authenticated;

create or replace function public.admin_get_checkins_by_site(p_days int default 14)
returns table (site_id text, site_name text, count int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select s.site_id, s.name, count(c.id)::int
  from public.sites s
  left join public.checkins c on c.site_id = s.site_id and c.checkin_at >= now() - (greatest(p_days, 1) || ' days')::interval
  group by s.site_id, s.name
  order by count(c.id) desc;
end;
$$;

revoke all on function public.admin_get_checkins_by_site(int) from public;
grant execute on function public.admin_get_checkins_by_site(int) to authenticated;

-- ── Parametri ─────────────────────────────────────────────────────────────
-- One singleton row. default_capacity_reference feeds create_manager_site() below — a real,
-- wired parameter, not a decorative field.
create table public.platform_settings (
  id boolean primary key default true,
  default_capacity_reference int not null default 50,
  support_email text,
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id) values (true);

alter table public.platform_settings enable row level security;

create policy "platform_settings_select_admin" on public.platform_settings
  for select to authenticated using (public.is_admin());

revoke all on public.platform_settings from authenticated;
grant select on public.platform_settings to authenticated;

create or replace function public.admin_update_settings(p_default_capacity_reference int, p_support_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_default_capacity_reference < 1 then
    raise exception 'invalid capacity';
  end if;
  update public.platform_settings
  set default_capacity_reference = p_default_capacity_reference, support_email = nullif(trim(p_support_email), '')
  where id = true;
end;
$$;

revoke all on function public.admin_update_settings(int, text) from public;
grant execute on function public.admin_update_settings(int, text) to authenticated;

-- create_manager_site() now reads the platform default instead of the column's hardcoded 50.
create or replace function public.create_manager_site(p_name text, p_address text, p_timezone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_default_capacity int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status, capacity_reference)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval', coalesce(v_default_capacity, 50));

  insert into public.profiles (id, role, site_id, status)
  values (v_uid, 'manager', v_site_id, 'active');

  return v_site_id;
end;
$$;

-- ── Comunicazioni (Admin → Manager, in-app only) ─────────────────────────
create table public.broadcasts (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

-- Every manager can read every broadcast (there is no per-site targeting yet); Admin reads them too.
create policy "broadcasts_select_managers_and_admin" on public.broadcasts
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

revoke all on public.broadcasts from authenticated;
grant select on public.broadcasts to authenticated;

create or replace function public.admin_create_broadcast(p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if trim(p_title) = '' or trim(p_body) = '' then
    raise exception 'title and body are required';
  end if;
  insert into public.broadcasts (title, body, created_by) values (trim(p_title), trim(p_body), auth.uid());
end;
$$;

revoke all on function public.admin_create_broadcast(text, text) from public;
grant execute on function public.admin_create_broadcast(text, text) to authenticated;

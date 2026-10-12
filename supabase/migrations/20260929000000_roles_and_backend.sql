-- Gymly — backend reale a 3 ruoli (manager / coach / client)
-- Applicare questo file una sola volta, per intero, dalla Supabase Dashboard → SQL Editor.

-- ── Tipi ──────────────────────────────────────────────────────────────────
create type public.user_role as enum ('manager', 'coach', 'client');
create type public.profile_status as enum ('pending', 'active', 'rejected');
create type public.checkin_kind as enum ('client', 'coach');

-- ── Sedi ──────────────────────────────────────────────────────────────────
create table public.sites (
  site_id text primary key,
  name text not null,
  address text,
  timezone text not null,
  staleness_limit_s int not null default 120,
  opening_hours jsonb not null default '[]'::jsonb,
  capacity_reference int not null default 50,
  points_enabled boolean not null default true,
  manually_open boolean not null default true,
  manager_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.sites enable row level security;

create policy "sites_select_authenticated" on public.sites
  for select to authenticated using (true);

create policy "sites_update_own" on public.sites
  for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));

-- ── Profili ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  site_id text references public.sites(site_id),
  status public.profile_status not null default 'pending',
  full_name text,
  created_at timestamptz not null default now()
);

create index profiles_site_id_idx on public.profiles(site_id);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles_select_by_manager" on public.profiles
  for select to authenticated
  using (
    role in ('coach', 'client')
    and site_id in (select site_id from public.sites where manager_id = (select auth.uid()))
  );

-- Solo il nome può essere aggiornato direttamente dall'utente; ruolo/stato/sede
-- cambiano solo tramite le funzioni SECURITY DEFINER sotto (mai da un UPDATE diretto).
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Un cliente/coach crea la propria riga (in attesa di approvazione); un manager
-- non può mai nascere da un INSERT diretto, solo da create_manager_site().
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('coach', 'client')
    and status = 'pending'
  );

-- ── Check-in reali (presenza cliente = incide sulla fascia; coach = mai) ────
create table public.checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  site_id text not null references public.sites(site_id),
  kind public.checkin_kind not null,
  checkin_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  checkout_at timestamptz,
  constraint checkins_checkout_after_checkin check (checkout_at is null or checkout_at >= checkin_at)
);

create index checkins_site_open_idx on public.checkins(site_id, kind) where checkout_at is null;
create index checkins_user_idx on public.checkins(user_id);

alter table public.checkins enable row level security;

create policy "checkins_select_own" on public.checkins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "checkins_select_by_manager" on public.checkins
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create policy "checkins_insert_own" on public.checkins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and site_id = (select p.site_id from public.profiles p where p.id = (select auth.uid()))
    and (
      (kind = 'client' and (select p.role from public.profiles p where p.id = (select auth.uid())) = 'client')
      or (kind = 'coach' and (select p.role from public.profiles p where p.id = (select auth.uid())) = 'coach')
    )
  );

-- Solo checkout_at/last_confirmed_at sono modificabili dopo la creazione (mai kind/site_id/checkin_at).
revoke update on public.checkins from authenticated;
grant update (checkout_at, last_confirmed_at) on public.checkins to authenticated;

create policy "checkins_update_own" on public.checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Registro giornaliero del coach ───────────────────────────────────────
create table public.coach_logs (
  id bigint generated always as identity primary key,
  coach_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  site_id text not null references public.sites(site_id),
  note text not null,
  logged_for_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index coach_logs_site_idx on public.coach_logs(site_id);
create index coach_logs_coach_idx on public.coach_logs(coach_id, logged_for_date);

alter table public.coach_logs enable row level security;

create policy "coach_logs_select_own" on public.coach_logs
  for select to authenticated using (coach_id = (select auth.uid()));

create policy "coach_logs_select_by_manager" on public.coach_logs
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create policy "coach_logs_insert_own" on public.coach_logs
  for insert to authenticated
  with check (
    coach_id = (select auth.uid())
    and site_id = (select p.site_id from public.profiles p where p.id = (select auth.uid()))
    and (select p.role from public.profiles p where p.id = (select auth.uid())) = 'coach'
  );

revoke update on public.coach_logs from authenticated;
grant update (note) on public.coach_logs to authenticated;

create policy "coach_logs_update_own" on public.coach_logs
  for update to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- ── Punti / premi / riscatti (scoped al cliente) ─────────────────────────
create table public.point_rules (
  id text primary key,
  site_id text not null references public.sites(site_id),
  weekday_mask int not null,
  from_time text not null,
  to_time text not null,
  points int not null,
  daily_cap int not null
);

alter table public.point_rules enable row level security;

create policy "point_rules_select_authenticated" on public.point_rules
  for select to authenticated using (true);

create policy "point_rules_write_by_manager" on public.point_rules
  for all to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())))
  with check (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create table public.points_ledger (
  id bigint generated always as identity primary key,
  client_id uuid not null references auth.users(id),
  site_id text not null references public.sites(site_id),
  delta int not null,
  reason text not null,
  ref_id text,
  created_at timestamptz not null default now()
);

create index points_ledger_client_idx on public.points_ledger(client_id);

alter table public.points_ledger enable row level security;

create policy "points_ledger_select_own" on public.points_ledger
  for select to authenticated using (client_id = (select auth.uid()));

create policy "points_ledger_select_by_manager" on public.points_ledger
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create policy "points_ledger_insert_own" on public.points_ledger
  for insert to authenticated
  with check (client_id = (select auth.uid()));

create table public.rewards (
  id text primary key,
  site_id text not null references public.sites(site_id),
  title text not null,
  cost int not null,
  stock int
);

alter table public.rewards enable row level security;

create policy "rewards_select_authenticated" on public.rewards
  for select to authenticated using (true);

create policy "rewards_write_by_manager" on public.rewards
  for all to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())))
  with check (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create table public.redemptions (
  id text primary key,
  client_id uuid not null references auth.users(id),
  site_id text not null references public.sites(site_id),
  reward_id text not null references public.rewards(id),
  reward_title text not null,
  code text not null,
  qr text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index redemptions_client_idx on public.redemptions(client_id);

alter table public.redemptions enable row level security;

create policy "redemptions_select_own" on public.redemptions
  for select to authenticated using (client_id = (select auth.uid()));

create policy "redemptions_select_by_manager" on public.redemptions
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

create policy "redemptions_insert_own" on public.redemptions
  for insert to authenticated
  with check (client_id = (select auth.uid()));

-- ── Funzioni con privilegi elevati (uniche vie per creare un manager o approvare) ──

create or replace function public.create_manager_site(p_name text, p_address text, p_timezone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id)
  values (v_site_id, p_name, p_address, p_timezone, v_uid);

  insert into public.profiles (id, role, site_id, status)
  values (v_uid, 'manager', v_site_id, 'active');

  return v_site_id;
end;
$$;

revoke all on function public.create_manager_site(text, text, text) from public;
grant execute on function public.create_manager_site(text, text, text) to authenticated;

create or replace function public.set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_target_site text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;

  select site_id into v_target_site
  from public.profiles
  where id = p_user_id and role in ('coach', 'client');

  if v_target_site is null then
    raise exception 'profile not found';
  end if;

  if not exists (select 1 from public.sites where site_id = v_target_site and manager_id = v_manager) then
    raise exception 'not authorized';
  end if;

  update public.profiles set status = p_status where id = p_user_id;
end;
$$;

revoke all on function public.set_profile_status(uuid, public.profile_status) from public;
grant execute on function public.set_profile_status(uuid, public.profile_status) to authenticated;

-- ── Permessi di base sulle tabelle (RLS limita le RIGHE, questi i GRANT sulle tabelle) ──

grant usage on schema public to anon, authenticated;

grant select on public.sites to authenticated;
grant update on public.sites to authenticated;

grant select, insert on public.profiles to authenticated;
grant select, insert on public.checkins to authenticated;
grant select, insert on public.coach_logs to authenticated;
grant select, insert, update, delete on public.point_rules to authenticated;
grant select, insert on public.points_ledger to authenticated;
grant select, insert, update, delete on public.rewards to authenticated;
grant select, insert on public.redemptions to authenticated;

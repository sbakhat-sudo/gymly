-- The 'owner' role (Italian UI label: "Titolare") oversees several Manager-run sites that share one
-- business — a real ownership relationship, unlike `gym_chains` as it existed before this migration
-- (a purely cosmetic shared-name label with zero access control, see 20261022000000_gym_chains.sql's
-- own comment). `gym_chains.owner_id` is the real link: an owner's chain, and every site in it.

alter table public.gym_chains add column owner_id uuid references auth.users(id);
create unique index gym_chains_owner_id_idx on public.gym_chains(owner_id) where owner_id is not null;

-- The Owner's own HQ/office address — distinct from any Manager's site address, shown on the
-- Owner's own "Posizione Palestra" settings card (Impostazioni), not member-facing.
alter table public.gym_chains add column hq_address text;
alter table public.gym_chains add column hq_location geography(Point, 4326);

-- Real, Manager-set fields (never invented/computed) — there is no payment processor in this
-- project (see CLAUDE.md's pinned-dependency rule), so "paid/unpaid" is a fact the Manager records
-- by hand, not a number derived from a real transaction.
alter table public.profiles add column membership_type text check (membership_type in ('annual', 'monthly'));
alter table public.profiles add column payment_status text check (payment_status in ('paid', 'unpaid'));

-- ── is_owner() — the one safe way any RLS policy / RPC checks "is the caller an active Owner?" ────
create function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

-- The caller's own chain id, or null if they don't own one. Used to scope every owner_* query below
-- to exactly their own sites — never the whole platform (that's Admin's job, is_admin()).
create function public.owner_chain_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.gym_chains where owner_id = auth.uid();
$$;

revoke all on function public.owner_chain_id() from public;
grant execute on function public.owner_chain_id() to authenticated;

-- ── RLS: Owner reads profiles/sites/checkins scoped to its own chain's sites ───────────────────────
create policy "profiles_select_by_owner" on public.profiles
  for select to authenticated
  using (
    public.is_owner()
    and role in ('manager', 'coach', 'client')
    and site_id in (select site_id from public.sites where chain_id = public.owner_chain_id())
  );

create policy "sites_select_by_owner" on public.sites
  for select to authenticated
  using (public.is_owner() and chain_id = public.owner_chain_id());

create policy "checkins_select_by_owner" on public.checkins
  for select to authenticated
  using (
    public.is_owner()
    and site_id in (select site_id from public.sites where chain_id = public.owner_chain_id())
  );

-- ── owner_get_overview() — Dashboard KPI tiles + 7-day check-in activity, real numbers only ───────
-- Fatturato: there is no payment processor (see above) — this sums the SAME plan prices already
-- shown to the Admin in AdminPagamentoScreen.tsx's PLAN_TIERS (trial=free, pro=€49, business=€129).
-- If those prices ever change, update both places — flagged here on purpose, not auto-synced,
-- since an Edge Function/RPC can't import a .tsx constant.
create function public.owner_get_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_managers int;
  v_clients int;
  v_coaches int;
  v_revenue numeric;
  v_activity jsonb;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    return jsonb_build_object('managers', 0, 'clients', 0, 'coaches', 0, 'revenueEur', 0, 'activity7d', '[]'::jsonb);
  end if;

  select count(*) into v_managers from public.sites where chain_id = v_chain;
  select count(*) into v_clients from public.profiles where role = 'client' and site_id in (select site_id from public.sites where chain_id = v_chain);
  select count(*) into v_coaches from public.profiles where role = 'coach' and site_id in (select site_id from public.sites where chain_id = v_chain);
  select coalesce(sum(case plan when 'pro' then 49 when 'business' then 129 else 0 end), 0)
    into v_revenue
    from public.sites where chain_id = v_chain;

  select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(c.cnt, 0)) order by d), '[]'::jsonb)
    into v_activity
    from generate_series(current_date - interval '6 days', current_date, '1 day'::interval) d
    left join (
      select date_trunc('day', checkin_at) as day, count(*) as cnt
      from public.checkins
      where site_id in (select site_id from public.sites where chain_id = v_chain)
        and checkin_at >= current_date - interval '6 days'
      group by 1
    ) c on c.day = d;

  return jsonb_build_object('managers', v_managers, 'clients', v_clients, 'coaches', v_coaches, 'revenueEur', v_revenue, 'activity7d', v_activity);
end;
$$;

revoke all on function public.owner_get_overview() from public;
grant execute on function public.owner_get_overview() to authenticated;

-- ── owner_get_managers() — the Managers table (page 2) ─────────────────────────────────────────────
create function public.owner_get_managers()
returns table (
  manager_id uuid,
  full_name text,
  email text,
  phone text,
  site_id text,
  site_name text,
  address text,
  address_verified boolean,
  client_count int,
  coach_count int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    return;
  end if;

  return query
  select
    p.id,
    p.full_name,
    au.email::text,
    p.phone,
    s.site_id,
    s.name,
    s.address,
    s.approval_status = 'active',
    -- `pr.site_id` must stay qualified: a bare `site_id` here is ambiguous between this function's
    -- own `site_id` OUT column (every RETURNS TABLE column becomes a same-named plpgsql variable)
    -- and public.profiles.site_id — Postgres error 42702, caught by testing this RPC directly.
    (select count(*)::int from public.profiles pr where pr.role = 'client' and pr.site_id = s.site_id),
    (select count(*)::int from public.profiles pr where pr.role = 'coach' and pr.site_id = s.site_id),
    s.created_at
  from public.sites s
  join public.profiles p on p.id = s.manager_id
  join auth.users au on au.id = p.id
  where s.chain_id = v_chain
  order by s.created_at desc;
end;
$$;

revoke all on function public.owner_get_managers() from public;
grant execute on function public.owner_get_managers() to authenticated;

-- ── owner_get_manager_detail() — page 3 (clients + coaches + revenue summary for one site) ─────────
create function public.owner_get_manager_detail(p_manager_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_site record;
  v_clients jsonb;
  v_coaches jsonb;
  v_paid numeric;
  v_unpaid_count int;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;

  select s.site_id, s.name, s.address, s.plan, s.location, s.radius
    into v_site
    from public.sites s
    where s.manager_id = p_manager_id and s.chain_id = v_chain;
  if not found then
    raise exception 'not found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'fullName', p.full_name, 'membershipType', p.membership_type, 'paymentStatus', p.payment_status
    ) order by p.full_name), '[]'::jsonb)
    into v_clients
    from public.profiles p where p.role = 'client' and p.site_id = v_site.site_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'fullName', p.full_name) order by p.full_name), '[]'::jsonb)
    into v_coaches
    from public.profiles p where p.role = 'coach' and p.site_id = v_site.site_id;

  select coalesce(sum(case when payment_status = 'paid' then 1 else 0 end), 0),
         coalesce(sum(case when payment_status = 'unpaid' then 1 else 0 end), 0)
    into v_paid, v_unpaid_count
    from public.profiles where role = 'client' and site_id = v_site.site_id;

  return jsonb_build_object(
    'siteId', v_site.site_id, 'siteName', v_site.name, 'address', v_site.address, 'plan', v_site.plan,
    'lat', ST_Y(v_site.location::geometry), 'lng', ST_X(v_site.location::geometry), 'radius', v_site.radius,
    'clients', v_clients, 'coaches', v_coaches, 'paidCount', v_paid, 'unpaidCount', v_unpaid_count
  );
end;
$$;

revoke all on function public.owner_get_manager_detail(uuid) from public;
grant execute on function public.owner_get_manager_detail(uuid) to authenticated;

-- ── owner_set_client_payment() — the only way membership_type/payment_status are ever written ──────
create function public.owner_set_client_payment(p_client_id uuid, p_type text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if p_type is not null and p_type not in ('annual', 'monthly') then
    raise exception 'invalid type';
  end if;
  if p_status is not null and p_status not in ('paid', 'unpaid') then
    raise exception 'invalid status';
  end if;

  update public.profiles
    set membership_type = p_type, payment_status = p_status
    where id = p_client_id
      and role = 'client'
      and site_id in (select site_id from public.sites where chain_id = v_chain);
  if not found then
    raise exception 'not authorized';
  end if;
end;
$$;

revoke all on function public.owner_set_client_payment(uuid, text, text) from public;
grant execute on function public.owner_set_client_payment(uuid, text, text) to authenticated;

-- ── owner_create_manager_record() — the profiles+sites half of "Add Manager" ────────────────────────
-- Called by the owner-create-manager Edge Function AFTER it creates the auth.users row (the one step
-- that genuinely needs the service_role key) — called with the OWNER's own JWT (not the admin
-- client), so auth.uid() here is the owner and is_owner() works exactly like every other RPC in this
-- file. Keeps the actual business-rule insert in one place (SQL), not duplicated in Deno.
create function public.owner_create_manager_record(
  p_manager_user_id uuid,
  p_full_name text,
  p_site_name text,
  p_address text,
  p_lat float8 default null,
  p_lng float8 default null,
  p_phone text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_default_capacity int;
  v_site_id text;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;

  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;
  v_default_capacity := coalesce(v_default_capacity, 50);

  -- The on_auth_user_created trigger (20261017000000_orphan_profile_trigger.sql) already inserted a
  -- placeholder 'unclaimed' profiles row the instant the Edge Function created the auth.users row —
  -- same as every other signup-completion path in this project, this UPDATEs that placeholder
  -- instead of INSERTing a second row (which would hit profiles_pkey). The guard against an
  -- already-claimed id (e.g. this function called twice for the same user) mirrors
  -- manager_create_member()'s exact check.
  if not exists (select 1 from public.profiles where id = p_manager_user_id and role = 'unclaimed') then
    raise exception 'profile already exists';
  end if;

  -- `phone` is saved here (not just used once to build the WhatsApp invite message) so the Owner's
  -- Managers list can offer a real "Message" action later, not just at creation time.
  update public.profiles set role = 'manager', status = 'active', full_name = p_full_name, phone = nullif(trim(coalesce(p_phone, '')), '') where id = p_manager_user_id;

  v_site_id := 'st_' || substr(md5(p_manager_user_id::text || clock_timestamp()::text), 1, 12);

  -- The "Add Manager" form (unlike self-registration) has no timezone field — defaults to
  -- Europe/Rome (the app's primary market); the new Manager can change it later like any other
  -- site setting.
  insert into public.sites (
    site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan,
    band_green_pct, band_amber_pct, chain_id, location
  )
  values (
    v_site_id, p_site_name, p_address, 'Europe/Rome', p_manager_user_id, 'active', v_default_capacity, 'trial',
    40, 75, v_chain,
    case when p_lat is not null and p_lng is not null then ST_MakePoint(p_lng, p_lat)::geography else null end
  );

  update public.profiles set site_id = v_site_id where id = p_manager_user_id;

  return v_site_id;
end;
$$;

revoke all on function public.owner_create_manager_record(uuid, text, text, text, float8, float8, text) from public;
grant execute on function public.owner_create_manager_record(uuid, text, text, text, float8, float8, text) to authenticated;

-- ── owner_get_hq() / owner_set_hq() — the Owner's own HQ address (Impostazioni card) ───────────────
create function public.owner_get_hq()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_address text;
  v_lat float8;
  v_lng float8;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    return jsonb_build_object('address', null, 'lat', null, 'lng', null);
  end if;

  select hq_address, ST_Y(hq_location::geometry), ST_X(hq_location::geometry)
    into v_address, v_lat, v_lng
    from public.gym_chains where id = v_chain;

  return jsonb_build_object('address', v_address, 'lat', v_lat, 'lng', v_lng);
end;
$$;

revoke all on function public.owner_get_hq() from public;
grant execute on function public.owner_get_hq() to authenticated;

create function public.owner_set_hq(p_address text, p_lat float8 default null, p_lng float8 default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;

  update public.gym_chains
    set hq_address = nullif(trim(p_address), ''),
        hq_location = case when p_lat is not null and p_lng is not null then ST_MakePoint(p_lng, p_lat)::geography else null end
    where id = v_chain;
end;
$$;

revoke all on function public.owner_set_hq(text, float8, float8) from public;
grant execute on function public.owner_set_hq(text, float8, float8) to authenticated;

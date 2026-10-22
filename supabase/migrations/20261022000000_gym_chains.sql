-- Groups multiple `sites` rows (each its own physical location — own address, own GPS geofence, own
-- single manager) under a shared "chain/brand" name, for businesses that run several locations under
-- one name. Deliberately does NOT change who can manage which site: every location keeps exactly one
-- manager, the same model as before. `chain_id` is just a label connecting sibling locations.

create table public.gym_chains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.gym_chains enable row level security;
-- Chain names are shown next to a site's own name/address, which is already visible to any
-- authenticated user (see the existing broad `sites` SELECT policy) — no reason to hide this one row.
create policy "gym_chains_select_all" on public.gym_chains for select to authenticated using (true);
revoke insert, update, delete on public.gym_chains from authenticated, anon;

alter table public.sites add column chain_id uuid references public.gym_chains(id);

-- Changes `create_manager_site`'s signature (new trailing param) — drop first, same rule as every
-- other RPC signature change in this migrations directory.
drop function if exists public.create_manager_site(text, text, text);

create function public.create_manager_site(p_name text, p_address text, p_timezone text, p_chain_name text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_default_capacity int;
  v_plan public.site_plan;
  v_chain_id uuid;
  v_chain_name text := nullif(trim(coalesce(p_chain_name, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select requested_plan into v_plan
  from public.profiles
  where id = v_uid and role = 'manager' and status = 'active' and site_id is null;
  if not found then
    raise exception 'not an approved manager awaiting a gym';
  end if;

  select default_capacity_reference into v_default_capacity from public.platform_settings where id = true;
  v_default_capacity := coalesce(v_default_capacity, 50);

  -- Join an existing chain with the same name (case-insensitive), or start a new one. Self-service,
  -- no approval gate: joining a chain only attaches a shared label, it never grants access to the
  -- other locations in it (each keeps its own, separate manager_id).
  if v_chain_name is not null then
    select id into v_chain_id from public.gym_chains where lower(name) = lower(v_chain_name);
    if not found then
      insert into public.gym_chains (name) values (v_chain_name) returning id into v_chain_id;
    end if;
  end if;

  v_site_id := 'st_' || substr(md5(v_uid::text || clock_timestamp()::text), 1, 12);

  insert into public.sites (site_id, name, address, timezone, manager_id, approval_status, capacity_reference, plan, band_green_pct, band_amber_pct, chain_id)
  values (v_site_id, p_name, p_address, p_timezone, v_uid, 'pending_approval', v_default_capacity, coalesce(v_plan, 'trial'), 40, 75, v_chain_id);

  update public.profiles set site_id = v_site_id where id = v_uid;

  return v_site_id;
end;
$$;

revoke all on function public.create_manager_site(text, text, text, text) from public;
grant execute on function public.create_manager_site(text, text, text, text) to authenticated;

-- Read-only: the Manager's own chain name + sibling locations (name, address, manager name) — never
-- grants any access to them, purely informational ("these other locations are the same brand as mine").
create or replace function public.manager_get_chain_sites(p_site_id text)
returns table (
  chain_name text,
  sibling_site_id text,
  sibling_name text,
  sibling_address text,
  sibling_manager_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain_id uuid;
begin
  if not exists (select 1 from public.sites where site_id = p_site_id and manager_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select chain_id into v_chain_id from public.sites where site_id = p_site_id;
  if v_chain_id is null then
    return;
  end if;

  return query
  select c.name, s.site_id, s.name, s.address, p.full_name
  from public.sites s
  join public.gym_chains c on c.id = s.chain_id
  left join public.profiles p on p.id = s.manager_id
  where s.chain_id = v_chain_id and s.site_id <> p_site_id
  order by s.name;
end;
$$;

revoke all on function public.manager_get_chain_sites(text) from public;
grant execute on function public.manager_get_chain_sites(text) to authenticated;

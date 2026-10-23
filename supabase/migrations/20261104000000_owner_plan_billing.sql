-- Owner's own app-plan billing lifecycle: active -> grace (3 days, automatic) -> deactivated, plus a
-- one-time-per-grace-period "24h left" warning flag. This is the Owner paying Gymly for THEIR plan
-- (gym_chains.plan) — entirely separate from `subscriptions`, which is a member paying a gym.
--
-- Same shape and same lessons as `subscriptions_lifecycle_hourly` (20261102010000):
--   1. each step's WHERE is scoped only to the status that step owns, so one bug can't sweep in rows
--      another step owns;
--   2. the cron body lives in a function with `revoke ... from public, anon, authenticated` (Supabase
--      grants EXECUTE on every new function to anon/authenticated by default);
--   3. re-running this migration re-registers the job by name, never duplicates it.
--
-- There is still no real payment provider: Admin records an Owner's payment with
-- admin_mark_owner_paid(). Like the Client's `warning_sent_at`, `plan_warning_sent_at` only marks that
-- the warning window has been reached — the Owner's own device reads it (and `plan_grace_end`) and shows
-- the in-app banner + a local notification, never a server push (see CLAUDE.md).

create type public.owner_plan_status as enum ('active', 'grace', 'deactivated');

alter table public.gym_chains
  add column plan_paid_until timestamptz,
  add column plan_status public.owner_plan_status not null default 'active',
  add column plan_grace_end timestamptz,
  add column plan_warning_sent_at timestamptz;

-- Existing chains get a month of cover so rolling this out never deactivates a live Owner on the spot.
update public.gym_chains set plan_paid_until = now() + interval '30 days' where plan_paid_until is null;

-- New chains (created at Owner approval): trial = 14 free days, any paid plan = payment due immediately,
-- so the next hourly run moves them into the 3-day grace window. Done in a trigger so
-- admin_set_profile_status() and create_manager_site() don't each need to know about billing.
create function public.gym_chains_set_billing_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.plan_paid_until is null then
    new.plan_paid_until := case when new.plan = 'trial' then now() + interval '14 days' else now() end;
  end if;
  return new;
end;
$$;

revoke all on function public.gym_chains_set_billing_defaults() from public, anon, authenticated;

create trigger gym_chains_billing_defaults
before insert on public.gym_chains
for each row execute function public.gym_chains_set_billing_defaults();

-- ── Lifecycle job ─────────────────────────────────────────────────────────────────────────────────
create function public.owner_plans_lifecycle()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) active -> grace: the paid period has ended and nothing was paid since. The 3 days run from
  -- plan_paid_until itself (not from "now"), so a late cron run never gives extra time.
  update public.gym_chains
  set plan_status = 'grace', plan_grace_end = plan_paid_until + interval '3 days'
  where plan_status = 'active' and plan_paid_until < now();

  -- 2) warning flag: once per grace period, inside the last 24h before deactivation.
  update public.gym_chains
  set plan_warning_sent_at = now()
  where plan_status = 'grace'
    and plan_warning_sent_at is null
    and plan_grace_end between now() and now() + interval '24 hours';

  -- 3) grace -> deactivated: the 3 days are over. Marks the chain, then switches the Owner's profile
  -- to 'rejected' — the exact state Admin's own manual deactivation uses, so the existing auth gate
  -- blocks them with no new code path. Only chains this step just moved are touched. Not written to
  -- admin_actions_log on purpose: that table's admin_id is NOT NULL and an automatic job has no admin.
  with expired as (
    update public.gym_chains
    set plan_status = 'deactivated'
    where plan_status = 'grace' and plan_grace_end < now()
    returning owner_id
  )
  update public.profiles p
  set status = 'rejected'
  from expired e
  where p.id = e.owner_id and p.role = 'owner' and p.status = 'active';
end;
$$;

revoke all on function public.owner_plans_lifecycle() from public, anon, authenticated;

create extension if not exists pg_cron with schema cron;
grant usage on schema cron to postgres;

select cron.schedule(
  'owner_plans_lifecycle_hourly',
  '0 * * * *',
  $$ select public.owner_plans_lifecycle(); $$
);

-- ── Admin: record an Owner's payment (also reactivates one the job deactivated) ──────────────────
create function public.admin_mark_owner_paid(p_owner_id uuid, p_months int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_name text;
  v_was public.owner_plan_status;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'invalid months';
  end if;

  select pr.full_name, gc.plan_status into v_name, v_was
  from public.profiles pr
  join public.gym_chains gc on gc.owner_id = pr.id
  where pr.id = p_owner_id and pr.role = 'owner';
  if not found then
    raise exception 'owner not found';
  end if;

  update public.gym_chains
  set plan_paid_until = greatest(coalesce(plan_paid_until, now()), now()) + make_interval(months => p_months),
      plan_status = 'active',
      plan_grace_end = null,
      plan_warning_sent_at = null
  where owner_id = p_owner_id;

  -- Only an Owner the billing job itself deactivated comes back automatically; one Admin rejected by
  -- hand for another reason stays rejected.
  if v_was = 'deactivated' then
    update public.profiles set status = 'active' where id = p_owner_id and role = 'owner';
  end if;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label, detail)
  values (v_admin, 'owner_activated', 'owner', p_owner_id::text, v_name, 'Pagamento piano registrato');
end;
$$;

revoke all on function public.admin_mark_owner_paid(uuid, int) from public;
grant execute on function public.admin_mark_owner_paid(uuid, int) to authenticated;

-- ── Owner: read my own billing state (drives the in-app banner + local notification) ─────────────
create function public.owner_get_plan_billing()
returns table (
  plan public.site_plan,
  plan_status public.owner_plan_status,
  plan_paid_until timestamptz,
  plan_grace_end timestamptz,
  plan_warning_sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;

  return query
  select gc.plan, gc.plan_status, gc.plan_paid_until, gc.plan_grace_end, gc.plan_warning_sent_at
  from public.gym_chains gc
  where gc.owner_id = auth.uid();
end;
$$;

revoke all on function public.owner_get_plan_billing() from public;
grant execute on function public.owner_get_plan_billing() to authenticated;

-- ── Admin's Owner roster: now with billing state, and including Owners the job deactivated ───────
-- (return type changes, so drop first). A deactivated Owner must stay listed — otherwise Admin could
-- never record their payment to bring them back. Owners rejected at signup (no chain) stay out.
drop function if exists public.admin_get_owners();

create function public.admin_get_owners()
returns table (
  owner_id uuid,
  full_name text,
  email text,
  chain_name text,
  plan public.site_plan,
  status public.profile_status,
  managers_count int,
  created_at timestamptz,
  plan_status public.owner_plan_status,
  plan_paid_until timestamptz,
  plan_grace_end timestamptz
)
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
  select
    p.id,
    p.full_name,
    au.email::text,
    gc.name,
    gc.plan,
    p.status,
    coalesce((select count(*)::int from public.sites s where s.chain_id = gc.id), 0),
    p.created_at,
    gc.plan_status,
    gc.plan_paid_until,
    gc.plan_grace_end
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.gym_chains gc on gc.id = p.chain_id
  where p.role = 'owner' and (p.status = 'active' or (p.status = 'rejected' and gc.id is not null))
  order by p.full_name;
end;
$$;

revoke all on function public.admin_get_owners() from public;
grant execute on function public.admin_get_owners() to authenticated;

-- Real Client subscription lifecycle: Monthly/Annual plan, chosen (and mock-paid) on first login,
-- then active -> grace -> blocked handled automatically by a cron job (next migration). This table is
-- deliberately separate from `profiles` (not a couple of extra columns there) so "no row yet" can mean
-- exactly one thing: this Client has never chosen a plan — see `subscription_required` below for how
-- that's told apart from "an existing Client this feature doesn't apply to retroactively".

create type public.subscription_plan as enum ('monthly', 'annual');
create type public.subscription_status as enum ('active', 'grace', 'blocked');

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  site_id text not null references public.sites(site_id),
  plan_type public.subscription_plan not null,
  status public.subscription_status not null default 'active',
  start_date date not null,
  expiry_date date not null,
  last_payment_date date not null,
  -- Set only when status flips to 'grace' (expiry_date + 3 days) — null otherwise, including for a
  -- freshly 'active' plan. Never recomputed from expiry_date on the fly: the grace window is fixed
  -- the moment it starts, so a later plan_type/expiry_date change (client_switch_plan) can't silently
  -- shift an already-running grace period.
  grace_end_date date,
  -- Set exactly once per grace period (the cron job's own idempotency guard: `where warning_sent_at
  -- is null`) — never cleared except by a payment, which starts a fresh cycle entirely.
  warning_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_site_id_idx on public.subscriptions(site_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "subscriptions_select_by_manager" on public.subscriptions
  for select to authenticated
  using (site_id in (select site_id from public.sites where manager_id = (select auth.uid())));

-- No insert/update/delete grants at all — every write goes through the SECURITY DEFINER RPCs below,
-- same convention as `profiles` (`revoke update on public.profiles from authenticated`).
revoke insert, update, delete on public.subscriptions from authenticated, anon;

-- `subscription_required` distinguishes "a brand-new Client who must choose a plan on first login"
-- from "an existing Client this feature doesn't apply to retroactively" — both have no `subscriptions`
-- row, so the row's mere absence can't tell them apart on its own. Backfilled to false for everyone
-- who already exists; stays true (the column default) for every Client created from now on, with no
-- change needed to `manager_create_member`/`complete_self_registration`/`redeem_invite`.
alter table public.profiles add column subscription_required boolean not null default true;
update public.profiles set subscription_required = false where role = 'client';

-- ── client_get_my_subscription() — one round-trip: my row (if any) + whether I must choose a plan ──
create function public.client_get_my_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_required boolean;
  v_sub record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select role, subscription_required into v_role, v_required from public.profiles where id = v_uid;
  -- Guards the flag's own meaning, not just who happens to call this: `subscription_required`
  -- defaults true on every profiles row regardless of role (only Clients were backfilled to false),
  -- so a non-Client caller with no subscriptions row would otherwise read as "needs a plan" too —
  -- harmless today (only the real Client app's root layout ever calls this), but wrong on its face.
  if v_role <> 'client' then
    return jsonb_build_object('subscription', null, 'needsPlanChoice', false);
  end if;

  select * into v_sub from public.subscriptions where user_id = v_uid;

  if not found then
    return jsonb_build_object('subscription', null, 'needsPlanChoice', coalesce(v_required, false));
  end if;

  return jsonb_build_object(
    'needsPlanChoice', false,
    'subscription', jsonb_build_object(
      'planType', v_sub.plan_type, 'status', v_sub.status, 'startDate', v_sub.start_date,
      'expiryDate', v_sub.expiry_date, 'lastPaymentDate', v_sub.last_payment_date,
      'graceEndDate', v_sub.grace_end_date, 'warningSentAt', v_sub.warning_sent_at
    )
  );
end;
$$;

revoke all on function public.client_get_my_subscription() from public;
grant execute on function public.client_get_my_subscription() to authenticated;

-- ── client_choose_plan() — the mandatory first-login choice, after the mock payment succeeds ───────
create function public.client_choose_plan(p_plan public.subscription_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_site_id text;
  v_period interval;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select role, site_id into v_role, v_site_id from public.profiles where id = v_uid;
  if v_role <> 'client' or v_site_id is null then
    raise exception 'not a client';
  end if;
  -- Guards a double-tapped "Paga" button: the second call finds the row already there and fails
  -- loudly instead of silently creating a duplicate or overwriting a real subscription.
  if exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'subscription already exists';
  end if;

  v_period := case p_plan when 'monthly' then interval '1 month' else interval '1 year' end;
  insert into public.subscriptions (user_id, site_id, plan_type, status, start_date, expiry_date, last_payment_date)
  values (v_uid, v_site_id, p_plan, 'active', current_date, current_date + v_period, current_date);
end;
$$;

revoke all on function public.client_choose_plan(public.subscription_plan) from public;
grant execute on function public.client_choose_plan(public.subscription_plan) to authenticated;

-- ── client_confirm_payment_during_grace() — pay while in 'grace' OR already 'blocked' ──────────────
-- One function, one path, for both: the only difference between "pay during grace" and "pay after
-- being blocked" is which status the row was in before — the outcome is identical, a fresh cycle
-- starting today. Never extends from the old expiry_date (that would silently gift back the days the
-- Client was overdue/blocked).
create function public.client_confirm_payment_during_grace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.subscription_plan;
  v_period interval;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select plan_type into v_plan from public.subscriptions where user_id = v_uid and status in ('grace', 'blocked');
  if not found then
    raise exception 'no subscription awaiting payment';
  end if;

  v_period := case v_plan when 'monthly' then interval '1 month' else interval '1 year' end;
  update public.subscriptions
    set status = 'active', grace_end_date = null, warning_sent_at = null,
        expiry_date = current_date + v_period, last_payment_date = current_date, updated_at = now()
    where user_id = v_uid;
end;
$$;

revoke all on function public.client_confirm_payment_during_grace() from public;
grant execute on function public.client_confirm_payment_during_grace() to authenticated;

-- ── client_switch_plan() — Monthly <-> Annual, a fresh full cycle from today, no fake proration ────
create function public.client_switch_plan(p_plan public.subscription_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_period interval;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'no subscription to switch';
  end if;

  v_period := case p_plan when 'monthly' then interval '1 month' else interval '1 year' end;
  update public.subscriptions
    set plan_type = p_plan, status = 'active', grace_end_date = null, warning_sent_at = null,
        expiry_date = current_date + v_period, last_payment_date = current_date, updated_at = now()
    where user_id = v_uid;
end;
$$;

revoke all on function public.client_switch_plan(public.subscription_plan) from public;
grant execute on function public.client_switch_plan(public.subscription_plan) to authenticated;

-- ── manager_get_client_subscriptions() — the "Abbonamenti" screen's table, LEFT JOIN so a Client ───
-- with no plan still shows up (status returned as null, told apart in the UI from every real status).
create function public.manager_get_client_subscriptions()
returns table (
  client_id uuid, full_name text, plan_type public.subscription_plan, status public.subscription_status,
  start_date date, expiry_date date, last_payment_date date
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_manager uuid := auth.uid();
  v_site_id text;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;

  return query
  select p.id, p.full_name, s.plan_type, s.status, s.start_date, s.expiry_date, s.last_payment_date
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  where p.role = 'client' and p.site_id = v_site_id
  order by p.full_name;
end;
$$;

revoke all on function public.manager_get_client_subscriptions() from public;
grant execute on function public.manager_get_client_subscriptions() to authenticated;

-- ── manager_assign_plan() — onboards a Client this feature doesn't apply to automatically ──────────
create function public.manager_assign_plan(p_client_id uuid, p_plan public.subscription_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_manager_site_id text;
  v_client_site_id text;
  v_period interval;
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_manager_site_id from public.profiles where id = v_manager and role = 'manager';
  if v_manager_site_id is null then
    raise exception 'not a manager';
  end if;
  select site_id into v_client_site_id from public.profiles where id = p_client_id and role = 'client';
  if v_client_site_id is distinct from v_manager_site_id then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from public.subscriptions where user_id = p_client_id) then
    raise exception 'subscription already exists';
  end if;

  v_period := case p_plan when 'monthly' then interval '1 month' else interval '1 year' end;
  insert into public.subscriptions (user_id, site_id, plan_type, status, start_date, expiry_date, last_payment_date)
  values (p_client_id, v_client_site_id, p_plan, 'active', current_date, current_date + v_period, current_date);
end;
$$;

revoke all on function public.manager_assign_plan(uuid, public.subscription_plan) from public;
grant execute on function public.manager_assign_plan(uuid, public.subscription_plan) to authenticated;

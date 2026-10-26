-- "Attività" now covers EVERYTHING people do in the app, not just check-ins / payments / sign-ins.
--
-- Until now the feed (get_activity_feed) could only be derived from tables that happen to record a fact
-- (checkins, payments, ratings, ...). Most actions leave no trace of who did them: a Manager changing the
-- opening hours or a client's subscription, an Owner editing a plan, a Coach writing a note, a message sent,
-- an invite created, a reward redeemed... This adds one append-only `activity_log` and a generic trigger that
-- writes a row for every insert / update / delete on the tables below, stamped with the real caller.
--
-- Privacy: only WHO / WHAT / WHEN and, for an edit, the NAMES of the fields that changed — never their
-- values, never a message body or a rating comment. System work (cron, migrations: no signed-in caller) is
-- not logged. Facts the feed already derives (check-in/out, payments, a rating or issue being sent, account
-- created / activated / deactivated, sign-in) are not logged a second time.

create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid not null,
  site_id text,
  -- 'entity:insert' | 'entity:update' | 'entity:delete'
  action text not null,
  -- Insert/delete: the name of the thing (plan, reward, person...). Update: comma-separated changed columns.
  detail text
);

create index activity_log_at_idx on public.activity_log (at desc);
create index activity_log_actor_idx on public.activity_log (actor_id, at desc);

-- Same lockdown as the other audit tables: nothing is granted; only the SECURITY DEFINER trigger writes and
-- get_activity_feed() reads. No update or delete path exists for anyone.
alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon, authenticated;

create function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_entity text := tg_argv[0];
  v_ignore text[] := coalesce(string_to_array(nullif(tg_argv[1], ''), ','), '{}') || array['updated_at', 'created_at'];
  v_row jsonb;
  v_changed text[];
  v_detail text;
  v_site text;
begin
  -- No signed-in caller = cron / migration / service work: not a person's action.
  if v_actor is null then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(e.key order by e.key)
      into v_changed
      from jsonb_each(to_jsonb(new)) e
      where e.value is distinct from (to_jsonb(old) -> e.key)
        and not (e.key = any(v_ignore));
    if v_changed is null then
      return null;
    end if;
    v_detail := array_to_string(v_changed, ',');
  else
    v_detail := nullif(coalesce(v_row ->> 'name', v_row ->> 'title', v_row ->> 'plan_name', v_row ->> 'full_name', ''), '');
  end if;

  v_site := coalesce(v_row ->> 'site_id', (select p.site_id from public.profiles p where p.id = v_actor));

  insert into public.activity_log (actor_id, site_id, action, detail)
  values (v_actor, v_site, v_entity || ':' || lower(tg_op), left(v_detail, 200));
  return null;
end;
$$;

revoke all on function public.log_activity() from public, anon, authenticated;

-- ── Who / what is covered ───────────────────────────────────────────────────────────────────────────
-- Profiles: edits and deletions (account creation and status changes are already derived).
create trigger log_activity after update or delete on public.profiles
  for each row execute function public.log_activity('profile', 'status,activated_at,deactivated_at');

create trigger log_activity after insert or update or delete on public.sites
  for each row execute function public.log_activity('site', '');

-- Subscriptions: assigning, switching, blocking, removing. The columns a payment or an Owner's plan edit
-- rewrites automatically are ignored (payments are already derived; a plan edit would otherwise log one row
-- per subscriber).
create trigger log_activity after insert or update or delete on public.subscriptions
  for each row execute function public.log_activity('subscription', 'last_payment_date,expiry_date,grace_end_date,warning_sent_at,plan_name,duration_days,price_eur,plan_description,plan_color,plan_tier');

-- Plan cards: the Owner's own plans, and only the Manager-made ones on the sites (the Owner's cards are
-- mirrored onto every site, which would log the same action once per site).
create trigger log_activity after insert or update or delete on public.owner_plan_cards
  for each row execute function public.log_activity('plan_card', '');
create trigger log_activity after insert or update on public.site_plan_cards
  for each row when (new.owner_card_id is null) execute function public.log_activity('plan_card', '');
create trigger log_activity_delete after delete on public.site_plan_cards
  for each row when (old.owner_card_id is null) execute function public.log_activity('plan_card', '');

create trigger log_activity after update on public.gym_chains
  for each row execute function public.log_activity('chain', '');
create trigger log_activity after insert on public.invites
  for each row execute function public.log_activity('invite', '');
create trigger log_activity after insert or update or delete on public.coach_logs
  for each row execute function public.log_activity('coach_note', '');
-- A rating / issue being SENT is derived; what happens afterwards (coach reply, manager note, status) is not.
create trigger log_activity after update on public.coach_ratings
  for each row execute function public.log_activity('rating', '');
create trigger log_activity after update on public.issue_reports
  for each row execute function public.log_activity('issue', '');
create trigger log_activity after insert on public.conversations
  for each row execute function public.log_activity('conversation', '');
create trigger log_activity after insert on public.messages
  for each row execute function public.log_activity('message', '');
create trigger log_activity after insert or update or delete on public.point_rules
  for each row execute function public.log_activity('point_rule', '');
create trigger log_activity after insert or update or delete on public.rewards
  for each row execute function public.log_activity('reward', '');
create trigger log_activity after insert or update on public.redemptions
  for each row execute function public.log_activity('redemption', '');
create trigger log_activity after update on public.platform_settings
  for each row execute function public.log_activity('platform_setting', '');

-- ── The feed: the same visibility rules as before, now also reading activity_log ─────────────────────
create or replace function public.get_activity_feed(p_limit int default 40, p_before timestamptz default null, p_role text default null)
returns table (
  event_at timestamptz,
  event_type text,
  actor_id uuid,
  actor_name text,
  actor_role text,
  detail text
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
  v_roles text[];
  v_all boolean := false;
  v_sites text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if public.is_admin() then
    v_roles := array['owner', 'coach', 'client'];
    v_all := true;
  elsif public.is_owner() then
    v_roles := array['manager', 'coach', 'client'];
    select coalesce(array_agg(s.site_id), '{}') into v_sites from public.sites s where s.chain_id = public.owner_chain_id();
  elsif exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'manager' and p.status = 'active') then
    v_roles := array['client', 'coach'];
    select coalesce(array_agg(p.site_id), '{}') into v_sites from public.profiles p where p.id = v_uid and p.site_id is not null;
  else
    raise exception 'not authorized';
  end if;

  return query
  with actors as (
    select p.id as aid, coalesce(nullif(trim(p.full_name), ''), '—') as aname, p.role::text as arole,
           p.created_at as acreated, p.activated_at as aactivated, p.deactivated_at as adeactivated
    from public.profiles p
    where p.role::text = any(v_roles)
      and (p_role is null or p.role::text = p_role)
      and (v_all or p.site_id = any(v_sites))
  ),
  ev as (
    select c.checkin_at as e_at, 'checkin'::text as e_type, a.aid, a.aname, a.arole, null::text as e_detail
    from public.checkins c join actors a on a.aid = c.user_id
    union all
    select c.checkout_at, 'checkout', a.aid, a.aname, a.arole, null
    from public.checkins c join actors a on a.aid = c.user_id
    where c.checkout_at is not null
    union all
    select sp.paid_on::timestamptz, 'payment', a.aid, a.aname, a.arole,
           sp.plan_name || ' · €' || to_char(sp.price_eur, 'FM999990.00')
    from public.subscription_payments sp join actors a on a.aid = sp.user_id
    union all
    select r.created_at, 'rating', a.aid, a.aname, a.arole, r.rating::text || '/5'
    from public.coach_ratings r join actors a on a.aid = r.client_id
    union all
    select i.created_at, 'issue', a.aid, a.aname, a.arole, i.severity::text
    from public.issue_reports i join actors a on a.aid = i.client_id
    union all
    select a.acreated, 'account_created', a.aid, a.aname, a.arole, null from actors a
    union all
    select a.aactivated, 'activated', a.aid, a.aname, a.arole, null from actors a where a.aactivated is not null
    union all
    select a.adeactivated, 'deactivated', a.aid, a.aname, a.arole, null from actors a where a.adeactivated is not null
    union all
    select u.last_sign_in_at, 'sign_in', a.aid, a.aname, a.arole, null
    from actors a join auth.users u on u.id = a.aid
    where u.last_sign_in_at is not null
    union all
    select l.at, l.action, a.aid, a.aname, a.arole, l.detail
    from public.activity_log l join actors a on a.aid = l.actor_id
  )
  select ev.e_at, ev.e_type, ev.aid, ev.aname, ev.arole, ev.e_detail
  from ev
  where ev.e_at is not null and (p_before is null or ev.e_at < p_before)
  order by ev.e_at desc
  limit v_limit;
end;
$$;

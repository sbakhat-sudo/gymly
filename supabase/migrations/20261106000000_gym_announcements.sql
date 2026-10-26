-- "Avvisi dalla palestra": a Manager tells their Clients (and Coaches) something — a closure, a change of
-- hours, a machine out of order, a new class. Shown on the Client's home until it expires, and listed in the
-- Manager's own "Avvisi" tab.
--
-- Remote push is out of scope for this project (local notifications only), so a notice reaches a Client the next
-- time they open the app — that is what the home strip is for.
--
-- Same access pattern as every other table here: reads through RLS, writes only through the SECURITY DEFINER
-- RPCs below (the Manager's own gym, nothing else).

create table public.gym_announcements (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(site_id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 80),
  body text check (body is null or char_length(body) <= 400),
  -- 'info' = news, 'warning' = heads-up (a machine is down, a class moved), 'closure' = the gym is closed / closes early.
  kind text not null default 'info' check (kind in ('info', 'warning', 'closure')),
  -- null = until the Manager removes it.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index gym_announcements_site_idx on public.gym_announcements (site_id, created_at desc);

alter table public.gym_announcements enable row level security;

-- A Manager reads every notice of their own gym, expired ones included (to see and delete them).
create policy "gym_announcements_select_by_manager" on public.gym_announcements
  for select to authenticated
  using (site_id in (select p.site_id from public.profiles p where p.id = (select auth.uid()) and p.role = 'manager'));

-- A Client or Coach reads only their own gym's notices that are still running.
create policy "gym_announcements_select_by_member" on public.gym_announcements
  for select to authenticated
  using (
    (expires_at is null or expires_at > now())
    and site_id in (select p.site_id from public.profiles p where p.id = (select auth.uid()) and p.role in ('client', 'coach'))
  );

revoke insert, update, delete on public.gym_announcements from authenticated, anon;

create function public.manager_create_announcement(
  p_title text, p_body text default null, p_kind text default 'info', p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site text;
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  select p.site_id into v_site from public.profiles p where p.id = auth.uid() and p.role = 'manager' and p.status = 'active';
  if v_site is null then
    raise exception 'not a manager';
  end if;
  if v_title is null then
    raise exception 'title required';
  end if;
  if p_kind not in ('info', 'warning', 'closure') then
    raise exception 'invalid kind';
  end if;

  insert into public.gym_announcements (site_id, created_by, title, body, kind, expires_at)
  values (v_site, auth.uid(), v_title, v_body, p_kind, p_expires_at)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.manager_create_announcement(text, text, text, timestamptz) from public, anon;
grant execute on function public.manager_create_announcement(text, text, text, timestamptz) to authenticated;

create function public.manager_delete_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site text;
begin
  select p.site_id into v_site from public.profiles p where p.id = auth.uid() and p.role = 'manager' and p.status = 'active';
  if v_site is null then
    raise exception 'not a manager';
  end if;
  delete from public.gym_announcements where id = p_id and site_id = v_site;
  if not found then
    raise exception 'not authorized';
  end if;
end;
$$;

revoke all on function public.manager_delete_announcement(uuid) from public, anon;
grant execute on function public.manager_delete_announcement(uuid) to authenticated;

-- Part of the "Attività" feed like everything else a Manager does.
create trigger log_activity after insert or delete on public.gym_announcements
  for each row execute function public.log_activity('announcement', '');

-- The Client's own subscription now also tells the colour of the plan, so the home card can look like the plan
-- the Manager / Owner made.
create or replace function public.client_get_my_subscription()
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
      'planName', coalesce(v_sub.plan_name, '—'), 'priceEur', v_sub.price_eur, 'planDescription', v_sub.plan_description,
      'planTier', v_sub.plan_tier, 'planColor', v_sub.plan_color, 'status', v_sub.status,
      'startDate', v_sub.start_date, 'expiryDate', v_sub.expiry_date, 'lastPaymentDate', v_sub.last_payment_date,
      'graceEndDate', v_sub.grace_end_date, 'warningSentAt', v_sub.warning_sent_at
    )
  );
end;
$$;

-- Generic audit trail for the Admin's own approve/suspend/reassign/activate-deactivate actions
-- (separate from `gps_audit_log`, which is GPS-geofence-specific) — powers the Dashboard's "Ultime
-- azioni Admin" table and its "Vedi tutto" full log. None of the four functions below change their
-- parameter list, so `create or replace function` is enough — no drop needed, unlike the GPS pair.
--
-- Same lockdown pattern as `gps_audit_log`: the table grants nothing to `authenticated`/`anon`. The
-- only way in is these four functions (write, each already SECURITY DEFINER + is_admin()-gated) and
-- `admin_get_actions_log` below (read, admin-only). Not editable or deletable by anyone, including
-- a normal Admin — no UPDATE/DELETE path exists at all.

create table public.admin_actions_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  -- 'site_approved' | 'site_suspended' | 'site_status_changed' | 'site_plan_changed' |
  -- 'site_reassigned' | 'manager_activated' | 'manager_deactivated'
  action_type text not null,
  entity_type text not null, -- 'site' | 'manager'
  entity_id text not null,
  -- Snapshot of the target's name AT THE TIME of the action (not a live join) — so the log still
  -- reads sensibly even if that gym/manager is later renamed or removed.
  entity_label text,
  detail text,
  created_at timestamptz not null default now()
);

create index admin_actions_log_created_idx on public.admin_actions_log(created_at desc);

alter table public.admin_actions_log enable row level security;
revoke all on public.admin_actions_log from authenticated, anon;

create or replace function public.admin_set_site_status(p_site_id text, p_status public.site_approval_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_site_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select name into v_site_name from public.sites where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;

  update public.sites
  set approval_status = p_status, approved_at = case when p_status = 'active' then now() else approved_at end
  where site_id = p_site_id;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label)
  values (
    v_admin,
    case p_status when 'active' then 'site_approved' when 'suspended' then 'site_suspended' else 'site_status_changed' end,
    'site', p_site_id, v_site_name
  );
end;
$$;

create or replace function public.admin_set_site_plan(p_site_id text, p_plan public.site_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_site_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select name into v_site_name from public.sites where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;

  update public.sites set plan = p_plan where site_id = p_site_id;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label, detail)
  values (v_admin, 'site_plan_changed', 'site', p_site_id, v_site_name, p_plan::text);
end;
$$;

create or replace function public.admin_reassign_site_manager(p_site_id text, p_new_manager_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_site_name text;
  v_new_manager_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where id = p_new_manager_id and role = 'manager' and status = 'active') then
    raise exception 'target is not an active manager';
  end if;

  select full_name into v_new_manager_name from public.profiles where id = p_new_manager_id;
  select name into v_site_name from public.sites where site_id = p_site_id;

  update public.sites set manager_id = p_new_manager_id where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label, detail)
  values (v_admin, 'site_reassigned', 'site', p_site_id, v_site_name, v_new_manager_name);
end;
$$;

-- Serves BOTH call sites that exist today (approving/rejecting a brand-new pending manager, and
-- deactivating/reactivating an already-active one) — the function itself can't tell which UI flow
-- called it, so the log says "activated"/"deactivated", which is accurate either way, rather than
-- guessing "approved" for a case that might really have been a reactivation.
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_manager_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;

  select full_name into v_manager_name from public.profiles where id = p_user_id and role = 'manager';
  if not found then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label)
  values (v_admin, case p_status when 'active' then 'manager_activated' else 'manager_deactivated' end, 'manager', p_user_id::text, v_manager_name);
end;
$$;

create or replace function public.admin_get_actions_log(p_limit int default 15)
returns table (
  id bigint,
  admin_name text,
  action_type text,
  entity_type text,
  entity_id text,
  entity_label text,
  detail text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select l.id, p.full_name, l.action_type, l.entity_type, l.entity_id, l.entity_label, l.detail, l.created_at
  from public.admin_actions_log l
  left join public.profiles p on p.id = l.admin_id
  order by l.created_at desc
  limit greatest(1, least(p_limit, 500));
end;
$$;

revoke all on function public.admin_get_actions_log(int) from public;
grant execute on function public.admin_get_actions_log(int) to authenticated;

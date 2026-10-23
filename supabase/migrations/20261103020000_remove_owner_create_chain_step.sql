-- Removes the Owner's separate post-approval "Crea la tua attività" step (CreateChainScreen.tsx):
-- the business is now created automatically, with a default name, the moment Admin approves the
-- Owner — same moment `admin_set_profile_status()` already flips status to 'active'. The Owner lands
-- straight in their dashboard instead of a blocking name-entry screen; the default name is
-- renameable anytime via owner_rename_chain() (new Impostazioni card).

-- ── admin_set_profile_status() — approving an Owner now also creates their chain ───────────────────
create or replace function public.admin_set_profile_status(p_user_id uuid, p_status public.profile_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_owner_name text;
  v_plan public.site_plan;
  v_chain_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('active', 'rejected') then
    raise exception 'invalid status';
  end if;

  select full_name, requested_plan into v_owner_name, v_plan from public.profiles where id = p_user_id and role = 'owner';
  if not found then
    raise exception 'profile not found';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  if p_status = 'active' then
    -- Re-link first, don't assume "no chain row yet": an orphaned gym_chains row (owner_id set,
    -- but this profile's own chain_id somehow still null — e.g. data from before this auto-create
    -- behaviour existed) must be reused, never re-inserted — gym_chains.owner_id is uniquely
    -- indexed, one chain per owner, so a blind insert here would violate it.
    select id into v_chain_id from public.gym_chains where owner_id = p_user_id;
    if v_chain_id is null then
      insert into public.gym_chains (name, owner_id, plan)
      values (coalesce(nullif(trim(v_owner_name), ''), 'La mia attività'), p_user_id, coalesce(v_plan, 'trial'))
      returning id into v_chain_id;
    end if;
    update public.profiles set chain_id = v_chain_id where id = p_user_id;
  end if;

  insert into public.admin_actions_log (admin_id, action_type, entity_type, entity_id, entity_label)
  values (v_admin, case p_status when 'active' then 'owner_activated' else 'owner_deactivated' end, 'owner', p_user_id::text, v_owner_name);
end;
$$;

-- Backfill, two passes:
-- 1) Re-link any already-active Owner whose own chain_id is null but who already has a gym_chains
--    row (an orphaned link — same situation admin_set_profile_status() above now defends against).
-- 2) Only THEN create a fresh default-named chain for whoever genuinely still has none at all —
--    CreateChainScreen.tsx (their only other way to get one) no longer exists, so without this
--    they'd be permanently stuck.
update public.profiles pr
set chain_id = gc.id
from public.gym_chains gc
where gc.owner_id = pr.id and pr.role = 'owner' and pr.chain_id is null;

with new_chains as (
  insert into public.gym_chains (name, owner_id, plan)
  select coalesce(nullif(trim(p.full_name), ''), 'La mia attività'), p.id, coalesce(p.requested_plan, 'trial')
  from public.profiles p
  where p.role = 'owner' and p.status = 'active' and p.chain_id is null
    and not exists (select 1 from public.gym_chains gc where gc.owner_id = p.id)
  returning id, owner_id
)
update public.profiles pr
set chain_id = nc.id
from new_chains nc
where pr.id = nc.owner_id;

-- No longer called by anything — CreateChainScreen.tsx (its one caller) is removed in this change.
drop function if exists public.create_owner_chain(text);

-- ── owner_get_chain_name() / owner_rename_chain() — Impostazioni's replacement for the old
-- one-time naming step: the Owner can change the auto-generated (or any) name anytime. Same
-- get/set-pair shape as owner_get_hq()/owner_set_hq() just above this one.
create function public.owner_get_chain_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select name from public.gym_chains where owner_id = auth.uid();
$$;

revoke all on function public.owner_get_chain_name() from public;
grant execute on function public.owner_get_chain_name() to authenticated;

create function public.owner_rename_chain(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;

  update public.gym_chains set name = v_name where id = v_chain;
end;
$$;

revoke all on function public.owner_rename_chain(text) from public;
grant execute on function public.owner_rename_chain(text) to authenticated;

-- Per-client row actions on "Abbonamenti" (Attiva / Disattiva / Elimina, alongside the existing
-- Assegna piano) — a Manager manually suspending or reinstating a specific member (e.g. a dispute,
-- a mistake), or deleting a wrongly-assigned subscription so the client goes back to "no plan" and
-- can be assigned a fresh one. Deliberately only 'active'/'blocked' as manual targets — never 'grace'
-- manually, since that status is meaningless without the grace_end_date the cron job itself computes.

create function public.manager_set_subscription_status(p_client_id uuid, p_status public.subscription_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_site_id text;
  v_client_site_id text;
begin
  if p_status not in ('active', 'blocked') then
    raise exception 'invalid status';
  end if;

  select site_id into v_manager_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_manager_site_id is null then
    raise exception 'not a manager';
  end if;
  select site_id into v_client_site_id from public.profiles where id = p_client_id and role = 'client';
  if v_client_site_id is distinct from v_manager_site_id then
    raise exception 'not authorized';
  end if;

  update public.subscriptions
    -- Clears any lingering grace state either way: going 'active' obviously shouldn't carry a stale
    -- grace_end_date/warning_sent_at, and going 'blocked' makes them moot too (nothing waits on them
    -- once already blocked).
    set status = p_status, grace_end_date = null, warning_sent_at = null, updated_at = now()
    where user_id = p_client_id;
  if not found then
    raise exception 'no subscription';
  end if;
end;
$$;

revoke all on function public.manager_set_subscription_status(uuid, public.subscription_status) from public;
grant execute on function public.manager_set_subscription_status(uuid, public.subscription_status) to authenticated;

create function public.manager_delete_subscription(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_site_id text;
  v_client_site_id text;
begin
  select site_id into v_manager_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_manager_site_id is null then
    raise exception 'not a manager';
  end if;
  select site_id into v_client_site_id from public.profiles where id = p_client_id and role = 'client';
  if v_client_site_id is distinct from v_manager_site_id then
    raise exception 'not authorized';
  end if;

  delete from public.subscriptions where user_id = p_client_id;
  if not found then
    raise exception 'no subscription';
  end if;
end;
$$;

revoke all on function public.manager_delete_subscription(uuid) from public;
grant execute on function public.manager_delete_subscription(uuid) to authenticated;

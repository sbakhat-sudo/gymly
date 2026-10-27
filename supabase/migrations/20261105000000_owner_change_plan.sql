-- The Owner changes their own Gymly plan (Trial / Pro / Business) from Impostazioni.
--
-- The one rule: there is no way back to Trial. Trial is the free introduction — once an Owner has moved to
-- Pro or Business they can switch between those two, never return to it. Everything else is allowed.
--
-- What a change does to billing (see 20261104000000_owner_plan_billing.sql):
--   * Trial -> Pro/Business: the paid plan is due right away. `plan_paid_until` becomes "now", so the next
--     hourly run of owner_plans_lifecycle() starts the automatic 3-day window; unpaid after that, the account
--     is switched off (the same path a new paid Owner follows when approved).
--   * Pro <-> Business: only the plan changes; whatever the Owner has paid (or still owes) stays as it was.
-- Every site of the chain takes the new plan too, because `sites.plan` is what the Owner dashboard's plan cost
-- and the per-site features read.

create function public.owner_change_plan(p_plan public.site_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_current public.site_plan;
begin
  if not public.is_owner() then
    raise exception 'not authorized';
  end if;
  if v_chain is null then
    raise exception 'owner has no chain';
  end if;
  if p_plan = 'trial' then
    raise exception 'cannot return to trial';
  end if;

  select plan into v_current from public.gym_chains where id = v_chain;
  if v_current = p_plan then
    raise exception 'already on this plan';
  end if;

  if v_current = 'trial' then
    update public.gym_chains
    set plan = p_plan,
        plan_paid_until = now(),
        plan_status = 'active',
        plan_grace_end = null,
        plan_warning_sent_at = null
    where id = v_chain;
  else
    update public.gym_chains set plan = p_plan where id = v_chain;
  end if;

  update public.sites set plan = p_plan where chain_id = v_chain;
end;
$$;

revoke all on function public.owner_change_plan(public.site_plan) from public, anon;
grant execute on function public.owner_change_plan(public.site_plan) to authenticated;

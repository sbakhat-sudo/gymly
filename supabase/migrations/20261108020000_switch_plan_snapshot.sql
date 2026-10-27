-- A Client changing plan ("Cambia piano" on the home card) now takes the new plan's colour, description and level
-- with it, exactly like the first choice does (client_choose_plan). Until now a switch only copied the name, price and
-- duration, so the card kept the old plan's colour/description/level. The new period also starts today, so the
-- progress bar on the card reads from the day of the change.
create or replace function public.client_switch_plan(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_site_id text;
  v_card record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select site_id into v_site_id from public.profiles where id = v_uid and role = 'client';
  if v_site_id is null then
    raise exception 'not a client';
  end if;
  if not exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'no subscription to switch';
  end if;

  select * into v_card from public.site_plan_cards where id = p_card_id and site_id = v_site_id and active;
  if not found then
    raise exception 'plan not available';
  end if;

  update public.subscriptions
    set status = 'active', grace_end_date = null, warning_sent_at = null,
        start_date = current_date,
        expiry_date = current_date + v_card.duration_days, last_payment_date = current_date, updated_at = now(),
        card_id = v_card.id, plan_name = v_card.name, price_eur = v_card.price_eur, duration_days = v_card.duration_days,
        plan_description = v_card.description, plan_tier = v_card.tier, plan_color = v_card.color,
        plan_type = null
    where user_id = v_uid;
end;
$$;

revoke all on function public.client_switch_plan(uuid) from public, anon;
grant execute on function public.client_switch_plan(uuid) to authenticated;

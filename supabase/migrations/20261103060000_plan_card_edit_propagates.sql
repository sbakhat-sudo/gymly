-- Editing a card (name/price/duration) now propagates live to every subscription still linked to it
-- (`card_id`) — a deliberate reversal of this feature's original "snapshot and never touch it again"
-- design: confirmed explicitly with the user that a Manager correcting a plan's price or duration
-- should update already-subscribed Clients immediately, not just new signups. `expiry_date` is
-- recalculated from each subscription's own `start_date` + the card's new `duration_days`, so a
-- duration change moves their real expiry too, not just the displayed number.
create or replace function public.manager_update_plan_card(p_card_id uuid, p_name text, p_price_eur float8, p_duration_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
begin
  select site_id into v_site_id from public.profiles where id = auth.uid() and role = 'manager';
  if v_site_id is null then
    raise exception 'not a manager';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_price_eur < 0 then
    raise exception 'invalid price';
  end if;
  if p_duration_days <= 0 then
    raise exception 'invalid duration';
  end if;

  update public.site_plan_cards
  set name = v_name, price_eur = p_price_eur, duration_days = p_duration_days
  where id = p_card_id and site_id = v_site_id;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.subscriptions
  set plan_name = v_name, price_eur = p_price_eur, duration_days = p_duration_days,
      expiry_date = start_date + p_duration_days, updated_at = now()
  where card_id = p_card_id;
end;
$$;

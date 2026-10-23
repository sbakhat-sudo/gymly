-- Lets the Manager pick a card's own colour (viola, giallo, arancione, blu, …) instead of the
-- auto-assigned one every card got until now — a deliberate choice (e.g. "oro" in gold-ish amber,
-- "VIP"/"VVIP" in orange/blue) rather than whatever a name-hash happened to land on. Nullable: a
-- card with no explicit colour falls back to the existing deterministic auto-tint client-side
-- (`avatarTint`), so nothing ever renders colourless.
alter table public.site_plan_cards add column color text;

drop function if exists public.manager_create_plan_card(text, float8, int, text);

create function public.manager_create_plan_card(p_name text, p_price_eur float8, p_duration_days int, p_description text default null, p_color text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
  v_id uuid;
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

  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, description, color)
  values (v_site_id, v_name, p_price_eur, p_duration_days, nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_color, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.manager_create_plan_card(text, float8, int, text, text) from public;
grant execute on function public.manager_create_plan_card(text, float8, int, text, text) to authenticated;

drop function if exists public.manager_update_plan_card(uuid, text, float8, int, text);

create function public.manager_update_plan_card(p_card_id uuid, p_name text, p_price_eur float8, p_duration_days int, p_description text default null, p_color text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id text;
  v_name text := nullif(trim(p_name), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_color text := nullif(trim(coalesce(p_color, '')), '');
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
  set name = v_name, price_eur = p_price_eur, duration_days = p_duration_days, description = v_description, color = v_color
  where id = p_card_id and site_id = v_site_id;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.subscriptions
  set plan_name = v_name, price_eur = p_price_eur, duration_days = p_duration_days, plan_description = v_description,
      expiry_date = start_date + p_duration_days, updated_at = now()
  where card_id = p_card_id;
end;
$$;

revoke all on function public.manager_update_plan_card(uuid, text, float8, int, text, text) from public;
grant execute on function public.manager_update_plan_card(uuid, text, float8, int, text, text) to authenticated;

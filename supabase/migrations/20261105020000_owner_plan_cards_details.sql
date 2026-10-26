-- Owner cards now carry the full set the Owner asked for: name, duration (monthly/annual), a colour
-- that makes each card recognisable, the price, and a description — all visible to Managers and
-- Clients (they ride the same `site_plan_cards` mirror rows and `subscriptions` snapshot columns that
-- Manager-made cards already use). The created date is `created_at`, set automatically.

alter table public.owner_plan_cards add column price_eur float8 not null default 0 check (price_eur >= 0);
alter table public.owner_plan_cards alter column price_eur drop default;
alter table public.owner_plan_cards add column description text;
alter table public.owner_plan_cards add column color text;

drop function if exists public.owner_create_plan_card(text, text);
drop function if exists public.owner_update_plan_card(uuid, text, text);

create function public.owner_create_plan_card(
  p_name text, p_kind text, p_price_eur float8, p_description text default null, p_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_color text := nullif(trim(coalesce(p_color, '')), '');
  v_id uuid;
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_kind not in ('monthly', 'annual') then
    raise exception 'invalid kind';
  end if;
  if p_price_eur is null or p_price_eur < 0 then
    raise exception 'invalid price';
  end if;

  insert into public.owner_plan_cards (chain_id, name, kind, price_eur, description, color)
  values (v_chain, v_name, p_kind, p_price_eur, v_description, v_color)
  returning id into v_id;

  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, description, color, owner_card_id)
  select s.site_id, v_name, p_price_eur, public.plan_kind_days(p_kind), v_description, v_color, v_id
  from public.sites s
  where s.chain_id = v_chain;

  return v_id;
end;
$$;

revoke all on function public.owner_create_plan_card(text, text, float8, text, text) from public, anon;
grant execute on function public.owner_create_plan_card(text, text, float8, text, text) to authenticated;

create function public.owner_update_plan_card(
  p_card_id uuid, p_name text, p_kind text, p_price_eur float8, p_description text default null, p_color text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chain uuid := public.owner_chain_id();
  v_name text := nullif(trim(p_name), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_color text := nullif(trim(coalesce(p_color, '')), '');
  v_days int := public.plan_kind_days(p_kind);
begin
  if not public.is_owner() or v_chain is null then
    raise exception 'not an owner';
  end if;
  if v_name is null then
    raise exception 'name required';
  end if;
  if p_kind not in ('monthly', 'annual') then
    raise exception 'invalid kind';
  end if;
  if p_price_eur is null or p_price_eur < 0 then
    raise exception 'invalid price';
  end if;

  update public.owner_plan_cards
  set name = v_name, kind = p_kind, price_eur = p_price_eur, description = v_description, color = v_color
  where id = p_card_id and chain_id = v_chain;
  if not found then
    raise exception 'not authorized';
  end if;

  update public.site_plan_cards
  set name = v_name, duration_days = v_days, price_eur = p_price_eur, description = v_description, color = v_color
  where owner_card_id = p_card_id;

  update public.subscriptions
  set plan_name = v_name, duration_days = v_days, price_eur = p_price_eur, plan_description = v_description, plan_color = v_color,
      expiry_date = start_date + v_days, updated_at = now()
  where card_id in (select id from public.site_plan_cards where owner_card_id = p_card_id);
end;
$$;

revoke all on function public.owner_update_plan_card(uuid, text, text, float8, text, text) from public, anon;
grant execute on function public.owner_update_plan_card(uuid, text, text, float8, text, text) to authenticated;

-- A site that joins the chain later gets the same details on its mirrored cards.
create or replace function public.sites_mirror_owner_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chain_id is null then
    return new;
  end if;
  insert into public.site_plan_cards (site_id, name, price_eur, duration_days, description, color, owner_card_id, active)
  select new.site_id, o.name, o.price_eur, public.plan_kind_days(o.kind), o.description, o.color, o.id, o.active
  from public.owner_plan_cards o
  where o.chain_id = new.chain_id
    and not exists (select 1 from public.site_plan_cards c where c.site_id = new.site_id and c.owner_card_id = o.id);
  return new;
end;
$$;

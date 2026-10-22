-- Adds the subscription block to check_in() — full `create or replace`, same body as
-- 20261016000000_checkin_cooldown_after_checkout.sql (the current, authoritative version) with one
-- new guard inserted right after the existing Manager-approval check (v_status) and before the
-- geofence lookup: no point computing a distance for someone who's blocked regardless of where they
-- are. A missing subscription row (never chose a plan, or an existing Client this feature doesn't
-- apply to) is NOT blocked here — only an explicit 'blocked' status is.
create or replace function public.check_in(
  p_site_id text,
  p_lat float8,
  p_lng float8,
  p_mocked boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_status public.profile_status;
  v_profile_site_id text;
  v_site_location geography;
  v_site_radius int;
  v_open_checkin timestamptz;
  v_last_checkout timestamptz;
  v_checkout_cooldown constant interval := interval '5 minutes';
  v_wait_minutes int;
  v_new_id bigint;
begin
  if v_uid is null then
    raise exception 'Devi essere autenticato per fare il check-in.';
  end if;

  if p_mocked then
    raise exception 'Posizione simulata rilevata: il check-in richiede una posizione reale del dispositivo.';
  end if;

  select role, status, site_id into v_role, v_status, v_profile_site_id
  from public.profiles where id = v_uid;

  if v_role is null then
    raise exception 'Profilo non trovato.';
  end if;
  if v_role <> 'client' then
    raise exception 'Solo i clienti possono fare il check-in in palestra.';
  end if;
  if v_status <> 'active' then
    raise exception 'Il tuo account non è ancora stato approvato dal manager.';
  end if;

  if exists (select 1 from public.subscriptions where user_id = v_uid and status = 'blocked') then
    raise exception 'Il tuo abbonamento è scaduto: contatta la reception per riattivarlo.';
  end if;

  if v_profile_site_id is distinct from p_site_id then
    raise exception 'Non sei iscritto a questa palestra.';
  end if;

  select location, radius into v_site_location, v_site_radius
  from public.sites where site_id = p_site_id;

  if not found then
    raise exception 'Palestra non trovata.';
  end if;
  if v_site_location is null then
    raise exception 'Questa palestra non ha ancora una posizione configurata.';
  end if;
  if not ST_DWithin(v_site_location, ST_MakePoint(p_lng, p_lat)::geography, v_site_radius + 50) then
    raise exception 'Sei troppo lontano dalla palestra per fare il check-in.';
  end if;

  select checkin_at into v_open_checkin
  from public.checkins
  where user_id = v_uid and site_id = p_site_id and checkout_at is null
  order by checkin_at desc
  limit 1;

  if v_open_checkin is not null then
    raise exception 'Hai già un check-in aperto in questa palestra: fai prima il check-out.';
  end if;

  select checkout_at into v_last_checkout
  from public.checkins
  where user_id = v_uid and site_id = p_site_id and checkout_at is not null
  order by checkout_at desc
  limit 1;

  if v_last_checkout is not null and v_last_checkout > now() - v_checkout_cooldown then
    v_wait_minutes := greatest(1, ceil(extract(epoch from (v_last_checkout + v_checkout_cooldown - now())) / 60)::int);
    raise exception 'Hai appena fatto il check-out: riprova tra % minuti.', v_wait_minutes;
  end if;

  insert into public.checkins (user_id, site_id, kind)
  values (v_uid, p_site_id, 'client')
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.check_in(text, float8, float8, boolean) to authenticated;

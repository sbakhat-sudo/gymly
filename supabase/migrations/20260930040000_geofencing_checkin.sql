-- Geofencing check-in. Adattato allo schema reale del progetto: non esistono le tabelle "salles" o
-- "memberships" — la palestra è `sites` (site_id text, non uuid) e il legame cliente↔palestra è già
-- dentro `profiles` (site_id + status). La tabella `checkins` esiste già ed è in uso reale (id
-- bigint identity, site_id text, kind, checkout_at, last_confirmed_at) — non viene ricreata: la RPC
-- check_in() qui sotto inserisce in quella stessa tabella dopo aver verificato la posizione,
-- riusando le RLS già presenti su `checkins` (self-access cliente + oversight manager, invariate).

create extension if not exists postgis;

alter table public.sites
  add column if not exists location geography(Point, 4326),
  add column if not exists radius int not null default 150;

create index if not exists sites_location_gix on public.sites using gist (location);

alter table public.profiles
  add column if not exists location_always boolean not null default false;

-- Il grant per l'auto-update di questa colonna da parte del cliente (stesso pattern già usato per
-- full_name/first_name/last_name/birth_year — RLS limita le RIGHE, questo grant limita le COLONNE).
grant update (location_always) on public.profiles to authenticated;

-- PostgREST restituisce una colonna `geography` come WKB grezzo, illeggibile da JS senza una
-- libreria in più (non prevista in questo progetto). Questa RPC di sola lettura la converte in
-- lat/lng lato server. SECURITY INVOKER (non DEFINER): `sites` è già leggibile da ogni utente
-- autenticato, nessuna elevazione di privilegio necessaria qui.
create or replace function public.get_site_geofence(p_site_id text)
returns table (lat float8, lng float8, radius int)
language sql
security invoker
set search_path = public
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng, radius
  from public.sites
  where site_id = p_site_id and location is not null;
$$;

grant execute on function public.get_site_geofence(text) to authenticated;

-- SECURITY DEFINER: unico modo per inserire un check-in reale con verifica di posizione lato
-- server. Usa solo auth.uid() e now() — mai un id o un orario passato dal client. Mai service_role:
-- resta chiamabile con la normale chiave anon/authenticated, come create_manager_site/set_profile_status.
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
  v_last_checkin timestamptz;
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

  select checkin_at into v_last_checkin
  from public.checkins
  where user_id = v_uid and site_id = p_site_id
  order by checkin_at desc
  limit 1;

  if v_last_checkin is not null and v_last_checkin > now() - interval '120 minutes' then
    raise exception 'Hai già fatto il check-in di recente: riprova tra qualche minuto.';
  end if;

  insert into public.checkins (user_id, site_id, kind)
  values (v_uid, p_site_id, 'client')
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.check_in(text, float8, float8, boolean) to authenticated;

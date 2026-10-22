-- Gymly — Modulo Feedback (valutazioni Coach + segnalazioni attrezzatura/struttura).
-- Vincoli del modulo (vedi prompt): nessun ruolo Admin coinvolto da nessuna parte; nessuna nuova
-- fonte di verità (le due tabelle sotto si appoggiano a `checkins`, già esistente, via `checkin_id`
-- — niente `site_id` duplicato: lo stato di una riga si scopre sempre risalendo a
-- `checkins.site_id` -> `sites.manager_id`); il Manager non scrive mai verso il Client (nessuna
-- policy/RPC gli dà un canale diretto); il Coach non vede mai `issue_reports`.
--
-- Nota di design importante: `coach_reply`, `manager_note`, `severity` e `status` sono scritti SOLO
-- tramite funzioni SECURITY DEFINER dedicate, mai con un UPDATE diretto concesso al ruolo
-- `authenticated` — in Postgres/Supabase Coach, Manager e Client condividono tutti lo stesso ruolo
-- di database (`authenticated`), quindi un GRANT su una colonna non può da solo distinguere "questa
-- colonna la tocca solo il Coach" da "questa la tocca solo il Manager": due semplici policy UPDATE
-- non basterebbero a impedire, ad esempio, a un Coach di scrivere `manager_note` sulla stessa riga
-- su cui ha il permesso di scrivere `coach_reply`. Una funzione dedicata per ogni singola scrittura,
-- con il controllo del chiamante al suo interno, è l'unico modo corretto di farlo rispettare.

create type public.issue_severity as enum ('urgent', 'minor');
create type public.issue_status as enum ('pending', 'resolved');

-- ── Valutazioni del Coach, una per check-out ────────────────────────────────
create table public.coach_ratings (
  id bigint generated always as identity primary key,
  checkin_id bigint not null unique references public.checkins(id),
  client_id uuid not null references auth.users(id),
  coach_id uuid not null references auth.users(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  coach_reply text,
  manager_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_ratings_coach_idx on public.coach_ratings(coach_id);
create index coach_ratings_client_idx on public.coach_ratings(client_id);

alter table public.coach_ratings enable row level security;

create policy "coach_ratings_select_own" on public.coach_ratings
  for select to authenticated using (client_id = (select auth.uid()));

create policy "coach_ratings_select_by_coach" on public.coach_ratings
  for select to authenticated using (coach_id = (select auth.uid()));

create policy "coach_ratings_select_by_manager" on public.coach_ratings
  for select to authenticated
  using (
    checkin_id in (
      select c.id from public.checkins c
      join public.sites s on s.site_id = c.site_id
      where s.manager_id = (select auth.uid())
    )
  );

-- Un cliente valuta solo un proprio check-in già chiuso (mai in corso), e solo un coach
-- davvero attivo nella stessa sede di quel check-in — mai un coach a caso o di un'altra palestra.
create policy "coach_ratings_insert_own" on public.coach_ratings
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and checkin_id in (
      select id from public.checkins
      where user_id = (select auth.uid()) and kind = 'client' and checkout_at is not null
    )
    and coach_id in (
      select p.id from public.profiles p
      where p.role = 'coach' and p.status = 'active'
      and p.site_id = (select c.site_id from public.checkins c where c.id = checkin_id)
    )
  );

-- Nessun UPDATE diretto: coach_reply/manager_note passano solo dalle funzioni sotto.
revoke update on public.coach_ratings from authenticated;

-- ── Segnalazioni di attrezzatura/struttura, indipendenti dalla valutazione ──
create table public.issue_reports (
  id bigint generated always as identity primary key,
  checkin_id bigint not null references public.checkins(id),
  client_id uuid not null references auth.users(id),
  description text,
  severity public.issue_severity,
  status public.issue_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index issue_reports_status_idx on public.issue_reports(status);
create index issue_reports_severity_idx on public.issue_reports(severity);
create index issue_reports_created_at_idx on public.issue_reports(created_at);

alter table public.issue_reports enable row level security;

create policy "issue_reports_select_own" on public.issue_reports
  for select to authenticated using (client_id = (select auth.uid()));

-- Volutamente NESSUNA policy "select_by_coach": il Coach non deve avere alcun accesso a questa
-- tabella, nemmeno indiretto — vedi i vincoli del modulo.
create policy "issue_reports_select_by_manager" on public.issue_reports
  for select to authenticated
  using (
    checkin_id in (
      select c.id from public.checkins c
      join public.sites s on s.site_id = c.site_id
      where s.manager_id = (select auth.uid())
    )
  );

create policy "issue_reports_insert_own" on public.issue_reports
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and checkin_id in (
      select id from public.checkins
      where user_id = (select auth.uid()) and kind = 'client' and checkout_at is not null
    )
  );

revoke update on public.issue_reports from authenticated;

grant select, insert on public.coach_ratings to authenticated;
grant select, insert on public.issue_reports to authenticated;

-- ── Funzioni ─────────────────────────────────────────────────────────────

-- Coach attivi nella palestra del chiamante (solo un Client approvato può chiamarla) — serve a
-- popolare la scelta "chi valuti?" nell'app, dato che un check-in cliente non registra già di suo
-- quale coach ha seguito quella sessione.
create or replace function public.get_my_site_coaches()
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'coach'
    and p.status = 'active'
    and p.site_id = (select site_id from public.profiles where id = (select auth.uid()))
  order by p.full_name nulls last;
$$;

revoke all on function public.get_my_site_coaches() from public;
grant execute on function public.get_my_site_coaches() to authenticated;

-- Le proprie valutazioni ricevute, col nome del cliente risolto lato server (il Coach non ha altro
-- modo di leggere il profilo di un cliente) — mai manager_note, che resta Manager<->Coach interno... anzi
-- Manager->Coach: qui invece è visibile al Coach stesso, è "una nota per lui", mai al Client.
create or replace function public.coach_get_my_ratings()
returns table (
  id bigint,
  created_at timestamptz,
  client_name text,
  rating int,
  comment text,
  coach_reply text,
  manager_note text
)
language sql
security definer
stable
set search_path = public
as $$
  select cr.id, cr.created_at, coalesce(cl.full_name, ''), cr.rating, cr.comment, cr.coach_reply, cr.manager_note
  from public.coach_ratings cr
  left join public.profiles cl on cl.id = cr.client_id
  where cr.coach_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.coach_get_my_ratings() from public;
grant execute on function public.coach_get_my_ratings() to authenticated;

-- Lo storico personale del Client: il proprio voto, l'eventuale risposta del coach, MAI manager_note
-- (interna a Manager/Coach) e mai le proprie segnalazioni (nessun canale di ritorno previsto, per
-- scelta del prompt — "non mostra le proprie segnalazioni").
create or replace function public.client_get_my_ratings()
returns table (
  id bigint,
  created_at timestamptz,
  coach_name text,
  rating int,
  comment text,
  coach_reply text
)
language sql
security definer
stable
set search_path = public
as $$
  select cr.id, cr.created_at, coalesce(co.full_name, ''), cr.rating, cr.comment, cr.coach_reply
  from public.coach_ratings cr
  left join public.profiles co on co.id = cr.coach_id
  where cr.client_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.client_get_my_ratings() from public;
grant execute on function public.client_get_my_ratings() to authenticated;

-- Il Coach risponde SOLO a una propria valutazione ricevuta, e scrive SOLO coach_reply.
create or replace function public.coach_reply_to_rating(p_rating_id bigint, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.coach_ratings where id = p_rating_id and coach_id = (select auth.uid())) then
    raise exception 'not authorized';
  end if;

  update public.coach_ratings
  set coach_reply = p_reply, updated_at = now()
  where id = p_rating_id;
end;
$$;

revoke all on function public.coach_reply_to_rating(bigint, text) from public;
grant execute on function public.coach_reply_to_rating(bigint, text) to authenticated;

-- Il Manager invia una nota SOLO verso il Coach (mai verso il Client: non esiste alcuna funzione o
-- colonna che il Client possa leggere con un contenuto scritto dal Manager su una valutazione).
create or replace function public.manager_note_on_rating(p_rating_id bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.coach_ratings cr
    join public.checkins c on c.id = cr.checkin_id
    join public.sites s on s.site_id = c.site_id
    where cr.id = p_rating_id and s.manager_id = (select auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  update public.coach_ratings
  set manager_note = p_note, updated_at = now()
  where id = p_rating_id;
end;
$$;

revoke all on function public.manager_note_on_rating(bigint, text) from public;
grant execute on function public.manager_note_on_rating(bigint, text) to authenticated;

-- Tutte le valutazioni della propria palestra, coi nomi di Client/Coach già risolti — il Manager può
-- già leggere quei profili (profiles_select_by_manager), quindi qui basta un resolve lato server per
-- evitare N+1 query lato app; stesso principio delle altre liste "manager_get_*" già in uso.
create or replace function public.manager_get_ratings()
returns table (
  id bigint,
  created_at timestamptz,
  client_name text,
  coach_id uuid,
  coach_name text,
  rating int,
  comment text,
  coach_reply text,
  manager_note text
)
language sql
security definer
stable
set search_path = public
as $$
  select cr.id, cr.created_at, coalesce(cl.full_name, ''), cr.coach_id, coalesce(co.full_name, ''), cr.rating, cr.comment, cr.coach_reply, cr.manager_note
  from public.coach_ratings cr
  join public.checkins c on c.id = cr.checkin_id
  join public.sites s on s.site_id = c.site_id
  left join public.profiles cl on cl.id = cr.client_id
  left join public.profiles co on co.id = cr.coach_id
  where s.manager_id = (select auth.uid())
  order by cr.created_at desc;
$$;

revoke all on function public.manager_get_ratings() from public;
grant execute on function public.manager_get_ratings() to authenticated;

create or replace function public.manager_get_issues()
returns table (
  id bigint,
  created_at timestamptz,
  client_name text,
  description text,
  severity public.issue_severity,
  status public.issue_status,
  resolved_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select ir.id, ir.created_at, coalesce(cl.full_name, ''), ir.description, ir.severity, ir.status, ir.resolved_at
  from public.issue_reports ir
  join public.checkins c on c.id = ir.checkin_id
  join public.sites s on s.site_id = c.site_id
  left join public.profiles cl on cl.id = ir.client_id
  where s.manager_id = (select auth.uid())
  order by ir.created_at desc;
$$;

revoke all on function public.manager_get_issues() from public;
grant execute on function public.manager_get_issues() to authenticated;

create or replace function public.manager_set_issue_severity(p_issue_id bigint, p_severity public.issue_severity)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.issue_reports ir
    join public.checkins c on c.id = ir.checkin_id
    join public.sites s on s.site_id = c.site_id
    where ir.id = p_issue_id and s.manager_id = (select auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  update public.issue_reports set severity = p_severity where id = p_issue_id;
end;
$$;

revoke all on function public.manager_set_issue_severity(bigint, public.issue_severity) from public;
grant execute on function public.manager_set_issue_severity(bigint, public.issue_severity) to authenticated;

-- Un solo click, nessun campo testuale — per scelta esplicita del prompt ("senza campo di risposta
-- testuale": il Manager non comunica mai col Client, nemmeno qui).
create or replace function public.manager_resolve_issue(p_issue_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.issue_reports ir
    join public.checkins c on c.id = ir.checkin_id
    join public.sites s on s.site_id = c.site_id
    where ir.id = p_issue_id and s.manager_id = (select auth.uid())
  ) then
    raise exception 'not authorized';
  end if;

  update public.issue_reports set status = 'resolved', resolved_at = now() where id = p_issue_id;
end;
$$;

revoke all on function public.manager_resolve_issue(bigint) from public;
grant execute on function public.manager_resolve_issue(bigint) to authenticated;

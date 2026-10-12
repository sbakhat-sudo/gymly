-- Open check-ins (checkout_at is null) were never being closed server-side: a client who forgot to
-- check out, or whose app was killed before it could, stayed counted as "present" indefinitely —
-- feeding both get_live_band's live headcount and the Manager's "In palestra ora" list with stale
-- data for days. The client already treats a check-in as auto-expired after 90+15=105 minutes of no
-- confirmation (domain/checkin.ts's resolveCheckinPhase); this makes the server agree too, via a
-- pg_cron job every 5 minutes, instead of relying on a client that may never reopen the app.

create extension if not exists pg_cron with schema cron;
grant usage on schema cron to postgres;

-- cron.schedule() re-registers (not duplicates) when a job with this same name already exists, so
-- re-running this migration is safe.
select cron.schedule(
  'close_stale_checkins',
  '*/5 * * * *',
  $$
    update public.checkins
    set checkout_at = last_confirmed_at + interval '105 minutes'
    where checkout_at is null
      and last_confirmed_at < now() - interval '105 minutes';
  $$
);

-- Defensive filter, belt-and-suspenders alongside the cron job above: even inside the up-to-5-minute
-- window before the next cron run, never let a check-in open for more than half a day count as live.
create or replace function public.get_live_band(p_site_id text)
returns text
language sql
security definer
set search_path = public
as $$
  with s as (
    select capacity_reference from public.sites where site_id = p_site_id
  ),
  live as (
    select count(*) as cnt
    from public.checkins
    where site_id = p_site_id and kind = 'client' and checkout_at is null
      and checkin_at > now() - interval '12 hours'
  )
  select
    case
      when (live.cnt::numeric / s.capacity_reference) > 0.75 then 'red'
      when (live.cnt::numeric / s.capacity_reference) >= 0.40 then 'amber'
      else 'green'
    end
  from live, s;
$$;

grant execute on function public.get_live_band(text) to authenticated;

-- A Coach's check-in is their "at work" presence, never tied to the member-facing occupancy band
-- (see CLAUDE.md), but it still needs to end automatically at closing time — otherwise it sits open
-- indefinitely the same way client check-ins used to before `close_stale_checkins`. Since nobody may
-- have the Coach's or the Manager's app open at the exact closing moment, this has to be server-side,
-- on the same pg_cron cadence as that migration, not a client-side timer (see conversation for the
-- full reasoning).
--
-- "Open" is deliberately the same combined definition `isGymOpenNow()` (gym-status.ts) already uses
-- client-side — weekly schedule AND the manager's manual toggle — not schedule alone: if the Manager
-- closes early, Coaches shouldn't stay "on shift" there until the originally posted closing time.
create or replace function public.close_stale_coach_checkins()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site record;
  v_local timestamp;
  v_weekday int; -- 0 = Monday .. 6 = Sunday, same convention as everywhere else in this project
  v_minutes int;
  v_is_open boolean;
begin
  for v_site in select site_id, timezone, manually_open, opening_hours from public.sites loop
    if not v_site.manually_open then
      v_is_open := false;
    else
      v_local := now() at time zone v_site.timezone;
      v_weekday := extract(isodow from v_local)::int - 1;
      v_minutes := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
      v_is_open := exists (
        select 1
        from jsonb_to_recordset(v_site.opening_hours) as h(weekday int, opens_at text, closes_at text)
        where h.weekday = v_weekday
          and v_minutes >= (split_part(h.opens_at, ':', 1)::int * 60 + split_part(h.opens_at, ':', 2)::int)
          and v_minutes <  (split_part(h.closes_at, ':', 1)::int * 60 + split_part(h.closes_at, ':', 2)::int)
      );
    end if;

    if not v_is_open then
      update public.checkins
      set checkout_at = now()
      where site_id = v_site.site_id and kind = 'coach' and checkout_at is null;
    end if;
  end loop;
end;
$$;

revoke all on function public.close_stale_coach_checkins() from public;

-- Separate job name from close_stale_checkins (kept in its own migration), so each can be inspected/
-- disabled independently in `select * from cron.job`. Re-running this migration just re-registers it.
select cron.schedule(
  'close_coach_checkins_at_closing',
  '*/5 * * * *',
  $$select public.close_stale_coach_checkins();$$
);

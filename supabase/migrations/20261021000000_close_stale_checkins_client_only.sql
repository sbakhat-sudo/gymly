-- Bug: `close_stale_checkins` (the 105-minute staleness job) had no `kind` filter, so it was closing
-- COACH check-ins too, not just Client ones. The 90+15=105 minute rule comes from the Client's own
-- "sei ancora qui?" confirmation flow (domain/checkin.ts#resolveCheckinPhase) — a Client who never
-- confirms is assumed to have left. A Coach's check-in has no such confirmation step at all (it's a
-- plain work-presence toggle, see CoachPresenceScreen.tsx), so `last_confirmed_at` is only ever set
-- once, at check-in time, and never updated again — meaning ANY coach shift longer than 105 minutes
-- (the normal case) was getting silently auto-checked-out by this job while the Coach was still at
-- work. Coach check-ins already have their own, correctly-scoped closing job
-- (`close_coach_checkins_at_closing`, see 20261012000000) that only closes them once the gym itself
-- is closed — this job should never have touched `kind = 'coach'` rows at all.
select cron.schedule(
  'close_stale_checkins',
  '*/5 * * * *',
  $$
    update public.checkins
    set checkout_at = greatest(last_confirmed_at + interval '105 minutes', checkin_at)
    where checkout_at is null and kind = 'client' and last_confirmed_at < now() - interval '105 minutes';
  $$
);

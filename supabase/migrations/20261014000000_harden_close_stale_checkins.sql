-- Found via live testing of close_stale_checkins: a single row whose checkout_at would compute to
-- before its own checkin_at (checkins_checkout_after_checkin's check constraint) makes the ENTIRE
-- UPDATE fail and roll back for every site in that cron run, not just the offending row — Postgres
-- aborts the whole statement on any constraint violation. In real app usage last_confirmed_at only
-- ever moves forward from checkin_at (set by an explicit "still here?" confirmation), so this can't
-- happen today — but a single future bug or a manually edited row could otherwise silently stop the
-- whole job from closing anyone's check-in at any site, with no visible error except deep in
-- cron.job_run_details. greatest(...) makes that structurally impossible instead of merely unlikely.
select cron.schedule(
  'close_stale_checkins',
  '*/5 * * * *',
  $$
    update public.checkins
    set checkout_at = greatest(last_confirmed_at + interval '105 minutes', checkin_at)
    where checkout_at is null and last_confirmed_at < now() - interval '105 minutes';
  $$
);

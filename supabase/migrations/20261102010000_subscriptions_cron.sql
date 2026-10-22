-- Hourly lifecycle job for subscriptions: active -> grace -> blocked, plus a one-time-per-grace-period
-- warning flag. Same `cron.schedule(name, ...)` pattern as `close_stale_checkins` (idempotent by name:
-- re-running this migration re-registers the job, never duplicates it) — and the same three lessons
-- from that job's real incident history, applied here from the start instead of discovered later:
--   1. A computed value that could ever violate a constraint must be structurally guarded (not "can't
--      happen in practice") — grace_end_date/expiry_date here are plain `date` arithmetic with no
--      check constraint between them, so there's nothing to violate, but every step below is still
--      scoped to the exact status it owns, never a blanket UPDATE.
--   2. `revoke execute ... from public, anon, authenticated` is required even though this job is only
--      ever invoked by `postgres` via cron — Supabase grants `authenticated`/`anon` EXECUTE on every
--      new function by default, and `revoke all from public` alone does not remove those.
--   3. Each step's WHERE clause is scoped only to the status it's responsible for transitioning, so a
--      bug in one step can't sweep in rows another step owns.
create extension if not exists pg_cron with schema cron;
grant usage on schema cron to postgres;

select cron.schedule(
  'subscriptions_lifecycle_hourly',
  '0 * * * *',
  $$
    -- 1) active -> grace: expiry_date has passed in the site's own timezone, nothing paid since.
    update public.subscriptions s
    set status = 'grace', grace_end_date = s.expiry_date + 3
    from public.sites st
    where s.site_id = st.site_id
      and s.status = 'active'
      and (s.expiry_date::timestamp at time zone st.timezone) < now();

    -- 2) warning flag: once per grace period (warning_sent_at is null), inside the last 24h of grace.
    -- The Client app reads this (and grace_end_date, already known) to show the "Devi pagare" banner
    -- and schedule its own local notification — this project has no real push service (Expo Go only,
    -- see CLAUDE.md), so "send a notification" server-side can only ever mean "mark that one should
    -- go out next time the Client's own device computes it," never an actual server-triggered push.
    update public.subscriptions s
    set warning_sent_at = now()
    from public.sites st
    where s.site_id = st.site_id
      and s.status = 'grace'
      and s.warning_sent_at is null
      and (s.grace_end_date::timestamp at time zone st.timezone) between now() and now() + interval '24 hours';

    -- 3) grace -> blocked: the 3-day grace window itself has now passed.
    update public.subscriptions s
    set status = 'blocked'
    from public.sites st
    where s.site_id = st.site_id
      and s.status = 'grace'
      and (s.grace_end_date::timestamp at time zone st.timezone) < now();
  $$
);

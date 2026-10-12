-- `revoke all on function ... from public` (in the previous migration) only strips the implicit
-- PUBLIC-pseudo-role grant — it does NOT remove the explicit EXECUTE grants Supabase's own project
-- bootstrap already gives `anon`/`authenticated` on every new function in `public` by default.
-- Confirmed live: close_stale_coach_checkins() was callable by an ordinary authenticated (Manager)
-- account. It's an internal maintenance routine meant to run only via pg_cron (as `postgres`), not an
-- app-facing endpoint, so lock it down explicitly instead of relying on the earlier revoke alone.
revoke execute on function public.close_stale_coach_checkins() from public, anon, authenticated;

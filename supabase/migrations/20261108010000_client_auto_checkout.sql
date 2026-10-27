-- Check-ins now close by themselves (a confirmed product decision, replacing the earlier "a Client is never
-- auto-checked-out" rule — see 20261024000000_remove_client_auto_checkout.sql):
--   * a Client, the moment the gym closes (the Manager's switch is turned off, or the opening hours end) — checked
--     out right away, at the time the job runs;
--   * a Client, after 3 hours inside — checked out at exactly check-in + 3 hours, so the recorded visit is never
--     longer;
--   * a Coach, the moment the gym closes (no 3-hour limit: a shift can be long).
-- Runs every minute, so a check-out lands within about a minute of the closing time or the 3-hour mark. The older
-- coach-only job (close_stale_coach_checkins, every 5 minutes) keeps working and is now just a backstop.

create or replace function public.close_checkins()
returns void
language sql
security definer
set search_path = public
as $$
  update public.checkins c
  set checkout_at = case
    when c.kind = 'client' and c.checkin_at + interval '3 hours' <= now() then c.checkin_at + interval '3 hours'
    else now()
  end
  where c.checkout_at is null
    and (
      not public.site_is_open(c.site_id)
      or (c.kind = 'client' and c.checkin_at + interval '3 hours' <= now())
    );
$$;

revoke all on function public.close_checkins() from public, anon, authenticated;

select cron.schedule('close_checkins', '* * * * *', $$select public.close_checkins();$$);

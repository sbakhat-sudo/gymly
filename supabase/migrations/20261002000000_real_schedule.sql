-- Orari stops guessing the future: the app is live now, so a member should only ever see what has
-- actually happened (real check-ins), never a simulated forecast for an hour or a day that hasn't
-- come yet. Two aggregate-only, SECURITY DEFINER RPCs (same shape as the existing `get_daily_bands`):
-- the client never receives a raw check-in count, only a band per hour — "never a people count"
-- holds here exactly as it does for the simulated mock curve.

-- One real week at a time (Monday..Sunday of `p_week_start`), hour by hour. A day that hasn't
-- happened yet simply has no rows — there is nothing to fake, since no check-in can exist in the
-- future. Backs both the day-pills' mini preview and the selected day's chart.
create or replace function public.get_week_real_bands(p_site_id text, p_week_start date)
returns table (date_key date, hour int, band text)
language sql
security definer
set search_path = public
as $$
  with s as (
    select timezone, capacity_reference from public.sites where site_id = p_site_id
  ),
  hourly as (
    select
      (c.checkin_at at time zone s.timezone)::date as date_key,
      extract(hour from (c.checkin_at at time zone s.timezone))::int as hour,
      count(distinct c.user_id) as cnt
    from public.checkins c, s
    where c.site_id = p_site_id
      and c.kind = 'client'
      and (c.checkin_at at time zone s.timezone)::date >= p_week_start
      and (c.checkin_at at time zone s.timezone)::date < p_week_start + 7
    group by date_key, hour
  )
  select h.date_key, h.hour,
         case
           when (h.cnt::numeric / s.capacity_reference) > 0.75 then 'red'
           when (h.cnt::numeric / s.capacity_reference) >= 0.40 then 'amber'
           else 'green'
         end as band
  from hourly h, s
  order by h.date_key, h.hour;
$$;

grant execute on function public.get_week_real_bands(text, date) to authenticated;

-- Historical pattern across the last `p_weeks` weeks (default 8 — the same lookback the median
-- forecast used to use), one row per weekday/hour that was ever observed. `samples` = how many of
-- those past occurrences actually had the gym open with at least one check-in that hour, so the UI
-- can say "not enough data yet" instead of presenting a thin pattern as a solid one.
create or replace function public.get_weekly_stats(p_site_id text, p_weeks int default 8)
returns table (weekday int, hour int, band text, samples int)
language sql
security definer
set search_path = public
as $$
  with s as (
    select timezone, capacity_reference from public.sites where site_id = p_site_id
  ),
  local as (
    select
      (extract(isodow from (c.checkin_at at time zone s.timezone))::int - 1) as weekday,
      extract(hour from (c.checkin_at at time zone s.timezone))::int as hour,
      (c.checkin_at at time zone s.timezone)::date as d,
      c.user_id
    from public.checkins c, s
    where c.site_id = p_site_id
      and c.kind = 'client'
      and c.checkin_at >= now() - (greatest(p_weeks, 0) * 7 || ' days')::interval
  ),
  per_day as (
    select weekday, hour, d, count(distinct user_id) as cnt
    from local
    group by weekday, hour, d
  ),
  agg as (
    select weekday, hour, avg(cnt) as avg_cnt, count(*) as samples
    from per_day
    group by weekday, hour
  )
  select a.weekday, a.hour,
         case
           when (a.avg_cnt / s.capacity_reference) > 0.75 then 'red'
           when (a.avg_cnt / s.capacity_reference) >= 0.40 then 'amber'
           else 'green'
         end as band,
         a.samples::int
  from agg a, s
  order by a.weekday, a.hour;
$$;

grant execute on function public.get_weekly_stats(text, int) to authenticated;

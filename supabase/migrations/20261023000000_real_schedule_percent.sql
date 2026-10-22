-- Adds a real occupancy PERCENTAGE (count ÷ the gym's own `capacity_reference`, the real number the
-- Manager configures in "Gestione Capienza") to the two historical RPCs — confirmed explicitly: the
-- Client screen now shows this number (hero card, weekly pills, "Consigliato per te"), not just a
-- band, as long as it's real and computed live from the Manager's own real capacity, never a static
-- example value. Also switches both functions from the old hardcoded 40%/75% split to the Manager's
-- own `band_green_pct`/`band_amber_pct` (set in 20261020000000) — `get_live_band` already uses these;
-- this closes the gap where the historical/pattern views still used the old fixed thresholds.
--
-- Both functions add a new OUT column, so `create or replace` can't be used — drop first.
-- Percentage is computed against the CURRENT `capacity_reference` at query time, not a value frozen
-- at the moment each check-in happened (this project stores no historical capacity snapshots) — if a
-- Manager changes capacity, past hours are re-expressed against the new number next time this is
-- queried, not literally "the percentage that applied back then".

drop function if exists public.get_week_real_bands(text, date);

create function public.get_week_real_bands(p_site_id text, p_week_start date)
returns table (date_key date, hour int, band text, pct int)
language sql
security definer
set search_path = public
as $$
  with s as (
    select timezone, capacity_reference, band_green_pct, band_amber_pct from public.sites where site_id = p_site_id
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
           when (h.cnt::numeric / s.capacity_reference) * 100 > s.band_amber_pct then 'red'
           when (h.cnt::numeric / s.capacity_reference) * 100 >= s.band_green_pct then 'amber'
           else 'green'
         end as band,
         least(100, greatest(0, round((h.cnt::numeric / s.capacity_reference) * 100)))::int as pct
  from hourly h, s
  order by h.date_key, h.hour;
$$;

grant execute on function public.get_week_real_bands(text, date) to authenticated;

drop function if exists public.get_weekly_stats(text, int);

create function public.get_weekly_stats(p_site_id text, p_weeks int default 8)
returns table (weekday int, hour int, band text, samples int, pct int)
language sql
security definer
set search_path = public
as $$
  with s as (
    select timezone, capacity_reference, band_green_pct, band_amber_pct from public.sites where site_id = p_site_id
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
           when (a.avg_cnt / s.capacity_reference) * 100 > s.band_amber_pct then 'red'
           when (a.avg_cnt / s.capacity_reference) * 100 >= s.band_green_pct then 'amber'
           else 'green'
         end as band,
         a.samples::int,
         least(100, greatest(0, round((a.avg_cnt / s.capacity_reference) * 100)))::int as pct
  from agg a, s
  order by a.weekday, a.hour;
$$;

grant execute on function public.get_weekly_stats(text, int) to authenticated;

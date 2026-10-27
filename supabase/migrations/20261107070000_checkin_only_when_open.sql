-- Nobody can check in while the gym is closed — neither a Client nor a Coach. "Closed" is the same rule used
-- everywhere else: the Manager's open/closed switch is off, or right now falls outside the weekly opening hours
-- (in the gym's own time zone; 24:00 is the exclusive end of day, 0 = Monday … 6 = Sunday).
--
-- Enforced where every check-in ends up — a trigger on the table — so it covers the Client's check_in() and the
-- Coach's direct insert alike, and a hand-made request cannot get around it. Check-outs are untouched.

create or replace function public.site_is_open(p_site_id text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_site record;
  v_local timestamp;
  v_weekday int;
  v_minutes int;
begin
  select timezone, manually_open, opening_hours into v_site from public.sites where site_id = p_site_id;
  if not found or not v_site.manually_open then
    return false;
  end if;

  v_local := now() at time zone v_site.timezone;
  v_weekday := extract(isodow from v_local)::int - 1;
  v_minutes := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  return exists (
    select 1
    from jsonb_to_recordset(v_site.opening_hours) as h(weekday int, opens_at text, closes_at text)
    where h.weekday = v_weekday
      and v_minutes >= (split_part(h.opens_at, ':', 1)::int * 60 + split_part(h.opens_at, ':', 2)::int)
      and v_minutes <  (split_part(h.closes_at, ':', 1)::int * 60 + split_part(h.closes_at, ':', 2)::int)
  );
end;
$$;

revoke all on function public.site_is_open(text) from public, anon;
grant execute on function public.site_is_open(text) to authenticated;

create or replace function public.checkins_only_when_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.site_is_open(new.site_id) then
    raise exception 'La palestra è chiusa: il check-in non è disponibile finché non riapre.';
  end if;
  return new;
end;
$$;

revoke all on function public.checkins_only_when_open() from public, anon, authenticated;

drop trigger if exists checkins_only_when_open on public.checkins;
create trigger checkins_only_when_open
  before insert on public.checkins
  for each row execute function public.checkins_only_when_open();

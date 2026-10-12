-- Real month-by-month new-gym counts for the Dashboard's growth chart — derived straight from
-- sites.created_at, nothing invented.
create or replace function public.admin_get_sites_growth(p_months int default 6)
returns table (month_key text, count int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select to_char(m, 'YYYY-MM'), count(s.site_id)::int
  from generate_series(date_trunc('month', current_date) - ((greatest(p_months, 1) - 1) || ' months')::interval, date_trunc('month', current_date), '1 month'::interval) m
  left join public.sites s on date_trunc('month', s.created_at) = m
  group by m
  order by m;
end;
$$;

revoke all on function public.admin_get_sites_growth(int) from public;
grant execute on function public.admin_get_sites_growth(int) to authenticated;

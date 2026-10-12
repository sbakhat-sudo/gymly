-- Tracks real app usage per gym: one row per manager per calendar day they opened the app.
-- Feeds the Dashboard's "palestre attive per mese" chart — a genuine usage trend, not a proxy
-- (unlike sites.created_at, which only shows new signups, never ongoing usage or churn).
create table public.manager_activity_log (
  manager_id uuid not null references auth.users(id),
  site_id text not null references public.sites(site_id),
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (manager_id, log_date)
);

alter table public.manager_activity_log enable row level security;

-- A manager may only record their own daily ping, for their own site — never on behalf of
-- another manager or another gym.
create policy "manager_activity_insert_own" on public.manager_activity_log
  for insert to authenticated
  with check (
    manager_id = (select auth.uid())
    and site_id = (select p.site_id from public.profiles p where p.id = (select auth.uid()) and p.role = 'manager')
  );

-- No SELECT policy: rows are only ever read in aggregate, by admins, through the
-- SECURITY DEFINER function below (which bypasses RLS deliberately and checks is_admin() itself).

create or replace function public.admin_get_manager_activity(p_months int default 6)
returns table (month_key text, site_count int)
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
  select to_char(m, 'YYYY-MM'), count(distinct l.site_id)::int
  from generate_series(date_trunc('month', current_date) - ((greatest(p_months, 1) - 1) || ' months')::interval, date_trunc('month', current_date), '1 month'::interval) m
  left join public.manager_activity_log l on date_trunc('month', l.log_date) = m
  group by m
  order by m;
end;
$$;

revoke all on function public.admin_get_manager_activity(int) from public;
grant execute on function public.admin_get_manager_activity(int) to authenticated;

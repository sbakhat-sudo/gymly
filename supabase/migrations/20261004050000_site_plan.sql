-- Which SaaS plan each gym is on — a real, stored attribute (not the decorative Pagamento mock
-- numbers from before): new gyms start on 'trial', Admin assigns 'pro'/'business' from there.
create type public.site_plan as enum ('trial', 'pro', 'business');

alter table public.sites add column plan public.site_plan not null default 'trial';

create or replace function public.admin_set_site_plan(p_site_id text, p_plan public.site_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.sites set plan = p_plan where site_id = p_site_id;
  if not found then
    raise exception 'site not found';
  end if;
end;
$$;

revoke all on function public.admin_set_site_plan(text, public.site_plan) from public;
grant execute on function public.admin_set_site_plan(text, public.site_plan) to authenticated;

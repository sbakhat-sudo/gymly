-- Exposes each Coach/Client's email to their own Manager — `auth.users` itself is never directly
-- readable by a client (anon/authenticated has no grant on it), so this is a narrow SECURITY
-- DEFINER read, scoped to exactly the caller's own site, for the "Clienti approvati" list
-- (RequestsScreen.tsx) and eventually Persone.
create or replace function public.manager_roster_emails(p_site_id text)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_manager uuid := auth.uid();
begin
  if v_manager is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.sites where site_id = p_site_id and manager_id = v_manager) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, au.email::text
    from public.profiles p
    join auth.users au on au.id = p.id
    where p.site_id = p_site_id and p.role in ('coach', 'client');
end;
$$;

revoke all on function public.manager_roster_emails(text) from public;
grant execute on function public.manager_roster_emails(text) to authenticated;

-- `platform_settings` is admin-only to SELECT (20261004020000), which is right for the row as a
-- whole (it also carries default_capacity_reference), but the support contact address is meant to
-- be shown to every signed-in role — the Manager's "Apertura" header now has a "Supporto" button
-- that needs it. A narrow SECURITY DEFINER function exposes just that one field, read-only, to any
-- authenticated user, without opening up the rest of the row.
create or replace function public.get_support_email()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select support_email from public.platform_settings where id = true;
$$;

revoke all on function public.get_support_email() from public;
grant execute on function public.get_support_email() to authenticated;

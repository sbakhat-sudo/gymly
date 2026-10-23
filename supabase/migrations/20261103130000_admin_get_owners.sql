-- Admin's own roster of (already-approved) Owners — until now Admin could only ever see Owners
-- waiting for approval, never a full list of active ones, and had no visibility into how many
-- Managers each Owner's chain actually has.
create function public.admin_get_owners()
returns table (
  owner_id uuid,
  full_name text,
  email text,
  chain_name text,
  plan public.site_plan,
  status public.profile_status,
  managers_count int,
  created_at timestamptz
)
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
  select
    p.id,
    p.full_name,
    au.email::text,
    gc.name,
    gc.plan,
    p.status,
    coalesce((select count(*)::int from public.sites s where s.chain_id = gc.id), 0),
    p.created_at
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.gym_chains gc on gc.id = p.chain_id
  -- Pending owners already have their own queue (admin_get_pending_owners / "Richieste") — this is
  -- the roster of already-approved ones, so a given owner is never listed in both places.
  where p.role = 'owner' and p.status = 'active'
  order by p.full_name;
end;
$$;

revoke all on function public.admin_get_owners() from public;
grant execute on function public.admin_get_owners() to authenticated;

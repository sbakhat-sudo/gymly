-- A Manager's own Owner (the one whose chain their gym belongs to) — lets the Manager start the
-- conversation themselves from their "Messaggi" tab, instead of only ever replying once the Owner
-- has written first. Same access pattern as the rest of the chat: SECURITY DEFINER, caller re-checked.
create function public.chat_get_my_owner()
returns table (
  owner_id uuid,
  owner_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'manager') then
    raise exception 'not authorized';
  end if;

  return query
  select distinct gc.owner_id, p.full_name
  from public.sites s
  join public.gym_chains gc on gc.id = s.chain_id
  join public.profiles p on p.id = gc.owner_id
  where s.manager_id = auth.uid() and gc.owner_id is not null;
end;
$$;

revoke all on function public.chat_get_my_owner() from public, anon;
grant execute on function public.chat_get_my_owner() to authenticated;

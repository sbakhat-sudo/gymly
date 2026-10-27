-- The Owner <-> Manager message list showed the other person's initials even when they have a photo: a Manager has no
-- permission to read an Owner's profile (and the Owner's own photo is not in the list the function returned). A new
-- function returns the same conversations plus the other person's photo URL, read inside the function. The old one stays.
create or replace function public.chat_get_conversations_with_photo()
returns table (conversation_id uuid, other_id uuid, other_name text, last_body text, last_at timestamptz, unread_count integer, other_avatar_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('owner', 'manager')) then
    raise exception 'not authorized';
  end if;

  return query
  select
    c.id,
    o.id,
    o.full_name,
    lm.body,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null),
    o.avatar_url
  from public.conversations c
  join public.profiles o on o.id = case when c.owner_id = auth.uid() then c.manager_id else c.owner_id end
  left join lateral (
    select m.body, m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where auth.uid() in (c.owner_id, c.manager_id)
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;
revoke all on function public.chat_get_conversations_with_photo() from public, anon;
grant execute on function public.chat_get_conversations_with_photo() to authenticated;

notify pgrst, 'reload schema';

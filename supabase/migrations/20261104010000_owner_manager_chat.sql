-- Owner <-> Manager direct messages, inside the app (replaces the "Messaggio" button that only ever
-- opened a WhatsApp link, and was dead for any Manager without a saved phone number).
--
-- One conversation per (Owner, Manager) pair, created the first time either side opens it. Same access
-- pattern as every other feature here: the tables have RLS on and NO policies and no direct grants, so
-- the only way in is the SECURITY DEFINER functions below, each of which re-checks that the caller is
-- really a participant. A Manager can only be reached by the Owner whose chain they run a gym in, and
-- vice versa — nobody can open a conversation with an arbitrary user.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, manager_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index conversations_manager_idx on public.conversations (manager_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;

-- ── Is the caller a participant? (internal — never callable from the client) ─────────────────────
create function public.chat_is_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    join public.profiles me on me.id = auth.uid() and me.status = 'active'
    where c.id = p_conversation_id and auth.uid() in (c.owner_id, c.manager_id)
  );
$$;

revoke all on function public.chat_is_participant(uuid) from public, anon, authenticated;

-- ── Open (or create) the conversation with another user ──────────────────────────────────────────
create function public.chat_open_conversation(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role public.user_role;
  v_owner uuid;
  v_manager uuid;
  v_id uuid;
begin
  select role into v_role from public.profiles where id = v_me and status = 'active';
  if v_role = 'owner' then
    v_owner := v_me;
    v_manager := p_other_id;
  elsif v_role = 'manager' then
    v_owner := p_other_id;
    v_manager := v_me;
  else
    raise exception 'not authorized';
  end if;

  -- The pair must really belong together: this Manager runs a gym in this Owner's chain.
  if not exists (
    select 1
    from public.sites s
    join public.gym_chains gc on gc.id = s.chain_id
    where gc.owner_id = v_owner and s.manager_id = v_manager
  ) then
    raise exception 'not authorized';
  end if;

  insert into public.conversations (owner_id, manager_id)
  values (v_owner, v_manager)
  on conflict (owner_id, manager_id) do nothing;

  select id into v_id from public.conversations where owner_id = v_owner and manager_id = v_manager;
  return v_id;
end;
$$;

revoke all on function public.chat_open_conversation(uuid) from public, anon;
grant execute on function public.chat_open_conversation(uuid) to authenticated;

-- ── My conversations, newest activity first, with the unread count ───────────────────────────────
create function public.chat_get_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_name text,
  last_body text,
  last_at timestamptz,
  unread_count int
)
language plpgsql
security definer
set search_path = public
stable
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
    (select count(*)::int from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  join public.profiles o on o.id = case when c.owner_id = auth.uid() then c.manager_id else c.owner_id end
  left join lateral (
    select m.body, m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where auth.uid() in (c.owner_id, c.manager_id)
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

revoke all on function public.chat_get_conversations() from public, anon;
grant execute on function public.chat_get_conversations() to authenticated;

-- ── The latest messages of one conversation, oldest first ────────────────────────────────────────
create function public.chat_get_messages(p_conversation_id uuid, p_limit int default 200)
returns table (
  id bigint,
  sender_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.chat_is_participant(p_conversation_id) then
    raise exception 'not authorized';
  end if;

  return query
  select t.id, t.sender_id, t.body, t.created_at, t.read_at
  from (
    select m.id, m.sender_id, m.body, m.created_at, m.read_at
    from public.messages m
    where m.conversation_id = p_conversation_id
    order by m.created_at desc, m.id desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) t
  order by t.created_at asc, t.id asc;
end;
$$;

revoke all on function public.chat_get_messages(uuid, int) from public, anon;
grant execute on function public.chat_get_messages(uuid, int) to authenticated;

-- ── Send ─────────────────────────────────────────────────────────────────────────────────────────
create function public.chat_send_message(p_conversation_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := nullif(trim(p_body), '');
begin
  if not public.chat_is_participant(p_conversation_id) then
    raise exception 'not authorized';
  end if;
  if v_body is null or char_length(v_body) > 2000 then
    raise exception 'invalid message';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), v_body);
end;
$$;

revoke all on function public.chat_send_message(uuid, text) from public, anon;
grant execute on function public.chat_send_message(uuid, text) to authenticated;

-- ── Mark the other side's messages as read ───────────────────────────────────────────────────────
create function public.chat_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.chat_is_participant(p_conversation_id) then
    raise exception 'not authorized';
  end if;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id and sender_id <> auth.uid() and read_at is null;
end;
$$;

revoke all on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_mark_read(uuid) to authenticated;

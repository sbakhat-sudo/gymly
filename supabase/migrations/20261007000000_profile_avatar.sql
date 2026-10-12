-- Profile photo for every role (Manager, Coach, Client, Admin): a plain column anyone can set on
-- their own row (the existing `profiles` UPDATE policy already scopes writes to `id = auth.uid()`,
-- same as `full_name`/`first_name`/etc — no new RPC needed), plus a public Storage bucket to hold
-- the images themselves, one file per user at `{user_id}/avatar.jpg`.
alter table public.profiles add column if not exists avatar_url text;

-- `profiles_update_own`'s row-level check (id = auth.uid()) is only half the gate: column access
-- itself was revoked wholesale in the original migration and re-granted one column at a time
-- (`full_name`, then `first_name`/`last_name`/`birth_year`) — `avatar_url` needs the same explicit
-- grant or a direct `.update({ avatar_url })` fails even though RLS would allow the row.
grant update (avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone (including anon) can read an avatar — it's a public profile picture, same as it being
-- shown to a Manager's roster or a Coach's presence list.
create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

-- Only the signed-in owner can write to their own folder — `{user_id}/...` — never someone else's.
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can replace their own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

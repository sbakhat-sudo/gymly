-- Promotes ONE existing Supabase Auth account to Admin. This is the only way an 'admin' profile is
-- ever created — there is no sign-up screen, no QR code, no link for it, by design.
--
-- Before running: sign in to the app at least once with the account you want as Admin (any role is
-- fine, even client/manager/coach — this overwrites it), so its row in auth.users exists. Then
-- replace the email below with that account's real email and run this file.

-- admin@gymly.test has no profiles row yet (freshly created, never completed signup), so insert
-- one directly rather than updating a non-existent row:
insert into public.profiles (id, role, status, full_name)
select id, 'admin', 'active', 'Admin'
from auth.users where email = 'admin@gymly.test'
on conflict (id) do update set role = 'admin', status = 'active', site_id = null;

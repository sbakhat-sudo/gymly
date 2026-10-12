-- Promotes the demo Admin account (admin.showcase@gymly.test, signed up normally as a throwaway
-- coach profile just to create its auth.users row — see 20261003020000_promote_admin.sql for why
-- this is the only way an 'admin' profile is ever created) so there's a ready-to-show Admin login
-- alongside the Manager/Coach/Client demo accounts.
insert into public.profiles (id, role, status, full_name)
select id, 'admin', 'active', 'Admin Demo'
from auth.users where email = 'admin.showcase@gymly.test'
on conflict (id) do update set role = 'admin', status = 'active', site_id = null;

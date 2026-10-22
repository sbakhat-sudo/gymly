-- New 5th role: 'owner' — oversees multiple Managers/sites it creates itself (a gym-chain business
-- owner), distinct from 'admin' (platform-wide). Added in its own migration/transaction, same
-- Postgres constraint already respected by 20261003000000_admin_role.sql: a new enum value can't be
-- used in the same transaction that adds it.
alter type public.user_role add value 'owner';

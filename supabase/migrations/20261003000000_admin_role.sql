-- Admin: a platform-wide supervisory role, not scoped to any single gym. Sees every gym and every
-- account, approves new gyms before they go live, and can deactivate any account — but does not
-- operate a gym day-to-day (that stays the Manager's job).
--
-- Run this file ALONE, by itself, and wait for it to finish before running the next migration.
-- Postgres forbids using a brand-new enum value in the same transaction that adds it, and the
-- Supabase SQL Editor sends a pasted script as one transaction — splitting this into its own file
-- is not optional.

alter type public.user_role add value 'admin';

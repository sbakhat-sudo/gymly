-- Removes the "Comunicazioni" feature entirely (Admin compose screen + Manager-side read-only feed)
-- — a deliberate product decision, not a leftover. Dropping the table cascades its own RLS policies.
drop function if exists public.admin_create_broadcast(text, text);
drop table if exists public.broadcasts;

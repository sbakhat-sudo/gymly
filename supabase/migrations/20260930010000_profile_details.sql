-- Self-editable profile details (Impostazioni → Profilo): name/surname for every role, birth year
-- for Coach and Client only (the UI enforces that split; the column exists for every role since a
-- future manager-facing use isn't ruled out, but nothing writes it for a manager today).
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists birth_year int;

-- Same column-level grant pattern as the existing `full_name` self-edit: a user may update only
-- these three columns on their own row (RLS policy `profiles_update_own` already restricts rows;
-- this restricts columns, so no one can self-promote role/site_id/status through this door).
grant update (first_name, last_name, birth_year) on public.profiles to authenticated;

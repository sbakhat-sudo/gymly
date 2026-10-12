-- Coach/client self-registration no longer waits for the gym manager's approval: a new account
-- is active immediately on signup. (The manager's "Richieste" approval screen keeps working for
-- any rows left over from before this change — it just won't receive new ones.)

drop policy "profiles_insert_self" on public.profiles;

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('coach', 'client')
    and status in ('pending', 'active')
  );

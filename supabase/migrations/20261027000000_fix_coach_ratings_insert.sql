-- Fix: `coach_ratings_insert_own` (20261026000000) validates that the chosen coach is really an
-- active coach at the check-in's own site by reading `profiles` from inside its own WITH CHECK
-- clause. That subquery runs as the calling Client under RLS — and no policy ever let a Client read
-- another user's profile row (only `get_my_site_coaches()`, a SECURITY DEFINER function, did) — so
-- the subquery always returned zero rows and the insert always failed with "new row violates
-- row-level security policy", for every Client, always. Live-verified broken before this fix.
--
-- Fix: let any authenticated user see an ACTIVE COACH profile at their OWN gym. This exposes
-- nothing new — it's exactly the same rows `get_my_site_coaches()` already returns to a Client — it
-- just lets the already-existing RLS check in `coach_ratings_insert_own` actually read them. The
-- self-referencing subquery (profiles policy reading profiles) terminates immediately: it resolves
-- through `profiles_select_own`, a plain `id = auth.uid()` equality with no further subquery.
create policy "profiles_select_site_coaches" on public.profiles
  for select to authenticated
  using (
    role = 'coach'
    and status = 'active'
    and site_id = (select site_id from public.profiles where id = (select auth.uid()))
  );

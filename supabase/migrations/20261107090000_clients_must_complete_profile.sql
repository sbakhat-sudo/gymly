-- Every active Client who has not really filled in their profile must now see the mandatory profile card.
-- When profile_completed_at was introduced, every account already active was marked as completed whether or not it
-- had a photo, name, birth date or address (see 20261104030000_profile_completion.sql). For Clients that left almost
-- everyone without a birth date or address, so the card never showed. Reset the flag for those: the card then
-- appears on their next opening, cannot be dismissed, and sets the flag again only once everything is saved.
-- Owners, Managers and Coaches are not touched.
update public.profiles
set profile_completed_at = null
where role = 'client'
  and status = 'active'
  and profile_completed_at is not null
  and (birth_date is null or avatar_url is null or first_name is null or last_name is null or home_address is null);

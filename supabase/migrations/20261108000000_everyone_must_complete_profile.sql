-- Every active Owner, Manager, Coach and Client who has not really filled in their profile must see the mandatory
-- profile card. When profile_completed_at was introduced, every account already active was marked as completed
-- whether or not it had a photo, name, birth date or address (see 20261104030000_profile_completion.sql), so the card
-- never showed to them. Reset the flag for those: the card appears on their next opening, cannot be dismissed, and
-- sets the flag again only once everything is saved. (Clients were already reset by 20261107090000; this catches any
-- that completed nothing since, and brings the staff roles in.) Admins are not part of this.
update public.profiles
set profile_completed_at = null
where role in ('owner', 'manager', 'coach', 'client')
  and status = 'active'
  and profile_completed_at is not null
  and (birth_date is null or avatar_url is null or first_name is null or last_name is null or home_address is null);

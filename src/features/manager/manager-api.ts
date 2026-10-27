import * as Crypto from 'expo-crypto';

import { logger } from '@/lib/logger';
import { createThrowawayClient, supabase } from '@/lib/supabase/client';
import { currentUserAgent } from '@/lib/user-agent';
import { REDEMPTION_CODE_ALPHABET, type OpeningHours } from '@/schemas';

export { getSiteGeofence, getSiteStatus, useLiveGymBand, type SiteGeofence, type SiteStatus } from '@/lib/gym-status';

const DEFAULT_TIMEZONE = 'Europe/Rome';

/** The Manager's first action once Admin-approved: creates their gym (`sites` row), using the plan
 * they picked at signup. Only valid for an approved Manager profile with no site yet. `chainName`
 * (optional) groups this location with any other gym already using that same name — a business
 * running several physical locations under one brand, each with its own manager, see the migration. */
export async function createGym(name: string, address: string, chainName?: string): Promise<void> {
  const { error } = await supabase.rpc('create_manager_site', {
    p_name: name.trim(),
    p_address: address.trim() || null,
    p_timezone: DEFAULT_TIMEZONE,
    p_chain_name: chainName?.trim() || null,
  });
  if (error) throw error;
}

export interface ChainSibling {
  siteId: string;
  name: string;
  address: string | null;
  managerName: string | null;
}

export interface ChainSites {
  chainName: string;
  siblings: ChainSibling[];
}

/** Other locations sharing this gym's chain name, if any — read-only context ("these are the same
 * brand as mine"), never access: each location keeps its own, separate manager. `null` when this
 * gym isn't part of a chain. */
export async function getChainSites(siteId: string): Promise<ChainSites | null> {
  const { data, error } = await supabase.rpc('manager_get_chain_sites', { p_site_id: siteId });
  if (error) throw error;
  if (data.length === 0) return null;
  return {
    chainName: data[0]?.chain_name ?? '',
    siblings: data.map((r) => ({ siteId: r.sibling_site_id, name: r.sibling_name, address: r.sibling_address, managerName: r.sibling_manager_name })),
  };
}

/** The real address stored in `platform_settings`, not a hardcoded one — that table is admin-only
 * to read, so this goes through a narrow RPC that exposes just this field. */
export async function getSupportEmail(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_support_email');
  if (error) throw error;
  return data;
}

/** Email per Coach/Client, keyed by user id — `auth.users` itself is never directly readable, so
 * this goes through a narrow RPC scoped to the caller's own site. */
export async function getRosterEmails(siteId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('manager_roster_emails', { p_site_id: siteId });
  if (error) throw error;
  return new Map(data.filter((r): r is { user_id: string; email: string } => r.email !== null).map((r) => [r.user_id, r.email]));
}

export async function setManuallyOpen(siteId: string, open: boolean): Promise<void> {
  const { error } = await supabase.from('sites').update({ manually_open: open }).eq('site_id', siteId);
  if (error) throw error;
}

export async function updateOpeningHours(siteId: string, hours: OpeningHours[]): Promise<void> {
  const { error } = await supabase.from('sites').update({ opening_hours: hours }).eq('site_id', siteId);
  if (error) throw error;
}

export interface CapacitySettings {
  capacityReference: number;
  bandGreenPct: number;
  bandAmberPct: number;
  notifyOnThreshold: boolean;
}

/** Capacity + the Manager's own green/amber threshold PERCENTAGES, saved together ("Gestione
 * Capienza"). `capacity_reference` overrides the platform default (`platform_settings`, no longer
 * Admin-editable since the Parametri screen was removed — fixed at its last saved value);
 * `band_green_pct`/`band_amber_pct` override the old fixed 40/75 split. Both are read live by
 * `get_live_band` on every call — no separate wiring needed for a change to take effect. */
export async function setCapacitySettings(siteId: string, settings: CapacitySettings): Promise<void> {
  const { error } = await supabase
    .from('sites')
    .update({
      capacity_reference: settings.capacityReference,
      band_green_pct: settings.bandGreenPct,
      band_amber_pct: settings.bandAmberPct,
      notify_manager_on_threshold: settings.notifyOnThreshold,
    })
    .eq('site_id', siteId);
  if (error) throw error;
}

export async function setSiteLocation(siteId: string, lat: number, lng: number, radiusM: number): Promise<void> {
  const { error } = await supabase.rpc('manager_set_site_location', {
    p_site_id: siteId,
    p_lat: lat,
    p_lng: lng,
    p_radius: radiusM,
    p_user_agent: currentUserAgent(),
  });
  if (error) throw error;
}

export interface PendingRequest {
  userId: string;
  fullName: string | null;
  /** The exact address the member gave when asking to join. */
  homeAddress: string | null;
  createdAt: string;
}

/** Client signups only — "Richieste" is a Client-only area (a Manager-added Coach, via
 * PeopleScreen's "Aggiungi Coach", is attached as already 'active', never 'pending', so a Coach
 * never actually needed approval here anyway). */
export async function getPendingRequests(siteId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, home_address, created_at')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .eq('role', 'client')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ userId: r.id, fullName: r.full_name, homeAddress: r.home_address, createdAt: r.created_at }));
}

export async function approveRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('set_profile_status', { p_user_id: userId, p_status: 'active' });
  if (error) throw error;
}

export async function rejectRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('set_profile_status', { p_user_id: userId, p_status: 'rejected' });
  if (error) throw error;
}

export interface PresentPerson {
  userId: string;
  kind: 'client' | 'coach';
  fullName: string | null;
  avatarUrl: string | null;
  checkinAt: string;
}

/** Everyone with an open check-in at the site right now (no checkout yet) — clients and coaches. */
export async function getPresentPeople(siteId: string): Promise<PresentPerson[]> {
  // Defensive, belt-and-suspenders alongside the `close_stale_checkins` pg_cron job (every 5 min):
  // never show a check-in open for more than half a day as "present", even inside that window.
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: checkins, error } = await supabase
    .from('checkins')
    .select('user_id, kind, checkin_at')
    .eq('site_id', siteId)
    .is('checkout_at', null)
    .gt('checkin_at', twelveHoursAgo)
    .order('checkin_at', { ascending: false });
  if (error) throw error;
  if (checkins.length === 0) return [];

  const ids = checkins.map((c) => c.user_id);
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
  if (profilesError) throw profilesError;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return checkins.map((c) => ({
    userId: c.user_id,
    kind: c.kind,
    fullName: profileById.get(c.user_id)?.full_name ?? null,
    avatarUrl: profileById.get(c.user_id)?.avatar_url ?? null,
    checkinAt: c.checkin_at,
  }));
}

export interface ActivityEvent {
  id: string;
  kind: 'checkin' | 'checkout';
  personName: string | null;
  at: string;
}

/** The site's own TODAY-only check-in/check-out events, newest first — "Attività in corso" on
 * "Situazione" is a feed of what's happening today, not a history. `todayStartIso` is the UTC
 * instant of local midnight at the site (`zonedTimeToUtc(local.dateKey, 0, site.timezone)`), passed
 * in rather than computed here since this module never imports the site's own timezone. Matches
 * rows where EITHER the check-in or the check-out could be today's (a check-in from yesterday that's
 * only just been checked out still belongs in today's feed) — built from those rows rather than a
 * dedicated events table: each row contributes a "checkin" event at `checkin_at` and, if it's been
 * closed, a separate "checkout" event at `checkout_at`, then both get re-filtered to strictly today
 * and re-sorted, since a check-out can land more recently than a newer row's check-in.
 * `checkins_select_by_manager` (RLS) already covers the whole site history, the same grant
 * `getCoachShifts`/`getPresentPeople` rely on. */
export async function getRecentActivity(siteId: string, todayStartIso: string): Promise<ActivityEvent[]> {
  const { data: checkins, error } = await supabase
    .from('checkins')
    .select('id, user_id, kind, checkin_at, checkout_at')
    .eq('site_id', siteId)
    .or(`checkin_at.gte.${todayStartIso},checkout_at.gte.${todayStartIso}`)
    .order('checkin_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  if (checkins.length === 0) return [];

  const ids = [...new Set(checkins.map((c) => c.user_id))];
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  if (profilesError) throw profilesError;
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

  const todayStartMs = Date.parse(todayStartIso);
  const events: ActivityEvent[] = [];
  for (const c of checkins) {
    const personName = nameById.get(c.user_id) ?? null;
    if (Date.parse(c.checkin_at) >= todayStartMs) events.push({ id: `${c.id}-in`, kind: 'checkin', personName, at: c.checkin_at });
    if (c.checkout_at && Date.parse(c.checkout_at) >= todayStartMs) events.push({ id: `${c.id}-out`, kind: 'checkout', personName, at: c.checkout_at });
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return events;
}

export interface RosterEntry {
  userId: string;
  role: 'coach' | 'client';
  fullName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'rejected';
  activatedAt: string | null;
  deactivatedAt: string | null;
  phone: string | null;
}

/** Deactivates or reactivates a Coach/Client in the Manager's own roster — the same
 * `set_profile_status` RPC "Richieste" uses to approve/reject, reused here for an already-active
 * person: it only checks "is this the manager of this profile's site", not "is it still pending". */
export async function setPersonStatus(userId: string, status: 'active' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('set_profile_status', { p_user_id: userId, p_status: status });
  if (error) throw error;
}

/** Permanently removes a Coach/Client from the Manager's own roster — distinct from
 * `setPersonStatus`, which just deactivates and keeps their history. */
export async function deletePerson(userId: string): Promise<void> {
  const { error } = await supabase.rpc('manager_delete_person', { p_user_id: userId });
  if (error) throw error;
}

/**
 * Generates a readable one-time password: same alphabet/technique as redemption codes (CSPRNG,
 * 32-symbol alphabet so `byte & 31` is unbiased) — see domain/redemption-code.ts.
 */
function generateTempPassword(): string {
  const bytes = Crypto.getRandomBytes(10);
  let out = '';
  for (const b of bytes) out += REDEMPTION_CODE_ALPHABET.charAt(b & 31);
  return out;
}

export interface NewMember {
  email: string;
  password: string;
}

/**
 * Fully provisions a Coach/Client on the Manager's behalf: creates their real login (a random
 * password — only they will ever type it, straight off the WhatsApp message the Manager sends) via
 * a throwaway auth session (so the Manager's own session is untouched), then attaches the profile
 * as 'active' — no "Richieste" wait, same as being pre-approved. The Manager shares the returned
 * password with them; they can change it later from Impostazioni.
 */
export async function createMember(role: 'coach' | 'client', fullName: string, email: string, phone: string): Promise<NewMember> {
  const password = generateTempPassword();
  const throwaway = createThrowawayClient();
  const { data, error: signUpError } = await throwaway.auth.signUp({ email: email.trim(), password });
  if (signUpError) throw signUpError;
  if (!data.user) throw new Error('signup did not return a user');

  const { error: attachError } = await supabase.rpc('manager_create_member', {
    p_user_id: data.user.id,
    p_role: role,
    p_full_name: fullName.trim() || null,
    p_phone: phone.trim() || null,
  });
  if (attachError) throw attachError;

  return { email: email.trim(), password };
}

export interface CoachShift {
  id: number;
  coachId: string;
  coachName: string | null;
  avatarUrl: string | null;
  checkinAt: string;
  checkoutAt: string | null;
}

/** Every Coach check-in/check-out at the site (open and closed), most recent first — the Manager's
 * "ore di lavoro" register. `checkins_select_by_manager` (RLS) already covers the whole history, not
 * just open rows, unlike `getPresentPeople`. Capped at the last 500 shifts: no pagination requested. */
export async function getCoachShifts(siteId: string): Promise<CoachShift[]> {
  const { data: checkins, error } = await supabase
    .from('checkins')
    .select('id, user_id, checkin_at, checkout_at')
    .eq('site_id', siteId)
    .eq('kind', 'coach')
    .order('checkin_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  if (checkins.length === 0) return [];

  const ids = [...new Set(checkins.map((c) => c.user_id))];
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
  if (profilesError) throw profilesError;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return checkins.map((c) => ({
    id: c.id,
    coachId: c.user_id,
    coachName: profileById.get(c.user_id)?.full_name ?? null,
    avatarUrl: profileById.get(c.user_id)?.avatar_url ?? null,
    checkinAt: c.checkin_at,
    checkoutAt: c.checkout_at,
  }));
}

/** Active AND deactivated coach/client rows — a deactivated person must stay visible, or the
 * Manager would have no way to find and reactivate them again. */
export async function getRoster(siteId: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, status, activated_at, deactivated_at, phone')
    .eq('site_id', siteId)
    .in('status', ['active', 'rejected'])
    .in('role', ['coach', 'client'])
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data
    .filter((r): r is typeof r & { role: 'coach' | 'client'; status: 'active' | 'rejected' } => (r.role === 'coach' || r.role === 'client') && r.status !== 'pending')
    .map((r) => ({
      userId: r.id,
      role: r.role,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      status: r.status,
      activatedAt: r.activated_at,
      deactivatedAt: r.deactivated_at,
      phone: r.phone,
    }));
}

// ── Feedback module — Manager side: read-only on ratings (the Manager only watches what passed
// between Client and Coach, never writes into it), full control on issues (severity + resolve) but
// NEVER a reply — the Manager has no channel to the Client anywhere in this module, by design. ────

export interface ManagerRatingEntry {
  id: number;
  createdAt: string;
  clientName: string;
  clientAvatarUrl: string | null;
  coachId: string;
  coachName: string;
  coachAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  coachReply: string | null;
}

/** `manager_get_ratings()` doesn't carry `avatar_url` itself (it's a rating, not a profile row), so
 * this does the same two-step batch join as `getPresentPeople` above: the ratings first, then one
 * `profiles` lookup for every distinct coach in the result — RLS already lets a Manager read their
 * own site's profiles (`profiles_select_by_manager`), so this needs no new grant or migration. */
export async function getRatings(): Promise<ManagerRatingEntry[]> {
  const { data, error } = await supabase.rpc('manager_get_ratings_with_photo');
  if (error) throw error;
  if (data.length === 0) return [];

  // The avatar photo is a nice-to-have, never a reason to fail the whole list — a lookup failure
  // degrades to no photo instead of throwing (see `feedback-api.ts#getMyRatingsHistory` for the same
  // pattern and why: a missing/invalid id otherwise throws Postgres `22P02` out of `.in()`).
  const coachIds = [...new Set(data.map((r) => r.coach_id).filter((id): id is string => Boolean(id)))];
  const avatarByCoachId = new Map<string, string | null>();
  if (coachIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, avatar_url').in('id', coachIds);
    if (profilesError) logger.error('manager.coach_avatar_lookup_failed', profilesError);
    else for (const p of profiles) avatarByCoachId.set(p.id, p.avatar_url);
  }

  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    clientName: r.client_name,
    clientAvatarUrl: r.client_avatar_url,
    coachId: r.coach_id,
    coachName: r.coach_name,
    coachAvatarUrl: avatarByCoachId.get(r.coach_id) ?? null,
    rating: r.rating,
    comment: r.comment,
    coachReply: r.coach_reply,
  }));
}

export type IssueSeverity = 'urgent' | 'minor';
export type IssueStatus = 'pending' | 'resolved';

export interface ManagerIssueEntry {
  id: number;
  createdAt: string;
  clientName: string;
  clientAvatarUrl: string | null;
  description: string | null;
  severity: IssueSeverity | null;
  status: IssueStatus;
  resolvedAt: string | null;
}

/** Same two-step batch join as `getRatings` above, now that `manager_get_issues()` carries
 * `client_id` — `profiles_select_by_manager` already covers reading a client's profile too. */
export async function getIssues(): Promise<ManagerIssueEntry[]> {
  const { data, error } = await supabase.rpc('manager_get_issues');
  if (error) throw error;
  if (data.length === 0) return [];

  // Same degrade-not-throw pattern as `getRatings` above.
  const clientIds = [...new Set(data.map((r) => r.client_id).filter((id): id is string => Boolean(id)))];
  const avatarByClientId = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, avatar_url').in('id', clientIds);
    if (profilesError) logger.error('manager.client_avatar_lookup_failed', profilesError);
    else for (const p of profiles) avatarByClientId.set(p.id, p.avatar_url);
  }

  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    clientName: r.client_name,
    clientAvatarUrl: avatarByClientId.get(r.client_id) ?? null,
    description: r.description,
    severity: r.severity,
    status: r.status,
    resolvedAt: r.resolved_at,
  }));
}

export async function setIssueSeverity(issueId: number, severity: IssueSeverity): Promise<void> {
  const { error } = await supabase.rpc('manager_set_issue_severity', { p_issue_id: issueId, p_severity: severity });
  if (error) throw error;
}

/** One click, no text field — the Manager closes an issue without ever messaging the Client. */
export async function resolveIssue(issueId: number): Promise<void> {
  const { error } = await supabase.rpc('manager_resolve_issue', { p_issue_id: issueId });
  if (error) throw error;
}

/** Undoes `resolveIssue` — back to pending, in case it was closed by mistake. */
export async function reopenIssue(issueId: number): Promise<void> {
  const { error } = await supabase.rpc('manager_reopen_issue', { p_issue_id: issueId });
  if (error) throw error;
}

/** The address saved for the gym (typed by the Owner when adding the Manager), or `null` if none. */
export async function getSiteAddress(siteId: string): Promise<string | null> {
  const { data, error } = await supabase.from('sites').select('address').eq('site_id', siteId).single();
  if (error) throw error;
  return data.address?.trim() || null;
}

import * as Crypto from 'expo-crypto';

import { createThrowawayClient, supabase } from '@/lib/supabase/client';
import { REDEMPTION_CODE_ALPHABET, type OpeningHours } from '@/schemas';

export { getSiteGeofence, getSiteStatus, useLiveGymBand, type SiteGeofence, type SiteStatus } from '@/lib/gym-status';

const DEFAULT_TIMEZONE = 'Europe/Rome';

/** The Manager's first action once Admin-approved: creates their gym (`sites` row), using the plan
 * they picked at signup. Only valid for an approved Manager profile with no site yet. */
export async function createGym(name: string, address: string): Promise<void> {
  const { error } = await supabase.rpc('create_manager_site', { p_name: name.trim(), p_address: address.trim() || null, p_timezone: DEFAULT_TIMEZONE });
  if (error) throw error;
}

/** The real address Admin configured in Parametri, not a hardcoded one — `platform_settings`
 * itself is admin-only to read, so this goes through a narrow RPC that exposes just this field. */
export async function getSupportEmail(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_support_email');
  if (error) throw error;
  return data;
}

export async function setManuallyOpen(siteId: string, open: boolean): Promise<void> {
  const { error } = await supabase.from('sites').update({ manually_open: open }).eq('site_id', siteId);
  if (error) throw error;
}

export async function updateOpeningHours(siteId: string, hours: OpeningHours[]): Promise<void> {
  const { error } = await supabase.from('sites').update({ opening_hours: hours }).eq('site_id', siteId);
  if (error) throw error;
}

/** Overrides the platform default (set by Admin in Parametri) for this one gym. Read live by
 * `get_live_band` on every call — no separate wiring needed for the change to take effect. */
export async function setSiteCapacity(siteId: string, capacity: number): Promise<void> {
  const { error } = await supabase.from('sites').update({ capacity_reference: capacity }).eq('site_id', siteId);
  if (error) throw error;
}

export async function setSiteLocation(siteId: string, lat: number, lng: number, radiusM: number): Promise<void> {
  const { error } = await supabase.rpc('manager_set_site_location', { p_site_id: siteId, p_lat: lat, p_lng: lng, p_radius: radiusM });
  if (error) throw error;
}

export interface PendingRequest {
  userId: string;
  role: 'coach' | 'client';
  fullName: string | null;
  createdAt: string;
}

export async function getPendingRequests(siteId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, created_at')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data
    .filter((r): r is typeof r & { role: 'coach' | 'client' } => r.role === 'coach' || r.role === 'client')
    .map((r) => ({ userId: r.id, role: r.role, fullName: r.full_name, createdAt: r.created_at }));
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

export interface Broadcast {
  id: number;
  title: string;
  body: string;
  createdAt: string;
}

/** Comunicazioni dall'Admin — in-app only, read-only for the Manager. */
export async function getBroadcasts(): Promise<Broadcast[]> {
  const { data, error } = await supabase.from('broadcasts').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  return data.map((b) => ({ id: b.id, title: b.title, body: b.body, createdAt: b.created_at }));
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

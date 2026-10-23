import { supabase } from './supabase/client';

export interface OpenCheckin {
  id: number;
  checkinAt: string;
  lastConfirmedAt: string;
}

/** One of the caller's own past visits (RLS: own rows only). `checkoutAt` is null while it is still open. */
export interface MyCheckin {
  id: number;
  checkinAt: string;
  checkoutAt: string | null;
}

/** The caller's own latest Client visits at a site, newest first. */
export async function getMyCheckins(userId: string, siteId: string, limit = 10): Promise<MyCheckin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, checkin_at, checkout_at')
    .eq('user_id', userId)
    .eq('site_id', siteId)
    .eq('kind', 'client')
    .order('checkin_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, checkinAt: r.checkin_at, checkoutAt: r.checkout_at }));
}

/** The caller's own open check-in of the given kind at the given site, if any (RLS: own rows only). */
export async function getOpenCheckin(userId: string, siteId: string, kind: 'client' | 'coach'): Promise<OpenCheckin | null> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, checkin_at, last_confirmed_at')
    .eq('user_id', userId)
    .eq('site_id', siteId)
    .eq('kind', kind)
    .is('checkout_at', null)
    .order('checkin_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, checkinAt: data.checkin_at, lastConfirmedAt: data.last_confirmed_at };
}

export async function realCheckIn(userId: string, siteId: string, kind: 'client' | 'coach'): Promise<OpenCheckin> {
  const { data, error } = await supabase
    .from('checkins')
    .insert({ user_id: userId, site_id: siteId, kind })
    .select('id, checkin_at, last_confirmed_at')
    .single();
  if (error) throw error;
  return { id: data.id, checkinAt: data.checkin_at, lastConfirmedAt: data.last_confirmed_at };
}

/**
 * The Client's real check-in, geofenced server-side (`check_in()`, see
 * `supabase/migrations/20260930040000_geofencing_checkin.sql`) — Coach check-in never goes through
 * this path (work presence, no location requirement). `error.message` on failure is already a
 * clear, ready-to-show Italian sentence: the RPC raises it itself (too far, not approved, already
 * checked in recently, etc.), never a raw Postgres/network error.
 */
export async function realCheckInWithLocation(siteId: string, lat: number, lng: number, mocked: boolean): Promise<OpenCheckin> {
  const { data: newId, error } = await supabase.rpc('check_in', { p_site_id: siteId, p_lat: lat, p_lng: lng, p_mocked: mocked });
  if (error) throw error;
  const { data, error: selectErr } = await supabase.from('checkins').select('id, checkin_at, last_confirmed_at').eq('id', newId).single();
  if (selectErr) throw selectErr;
  return { id: data.id, checkinAt: data.checkin_at, lastConfirmedAt: data.last_confirmed_at };
}

export async function realCheckOut(checkinId: number): Promise<void> {
  const { error } = await supabase.from('checkins').update({ checkout_at: new Date().toISOString() }).eq('id', checkinId);
  if (error) throw error;
}

export async function realConfirmStillHere(checkinId: number): Promise<string> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('checkins').update({ last_confirmed_at: nowIso }).eq('id', checkinId);
  if (error) throw error;
  return nowIso;
}

export interface ShiftHistoryEntry {
  id: number;
  checkinAt: string;
  checkoutAt: string | null;
}

/** The caller's own check-in/check-out history at this site (open and closed), most recent first —
 * the Coach's "ore di lavoro" register. RLS (`checkins_select_own`) already scopes this to their own
 * rows; the explicit `user_id` filter just keeps the query shaped like every other one in this module. */
export async function getOwnCheckinHistory(userId: string, siteId: string, kind: 'client' | 'coach'): Promise<ShiftHistoryEntry[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, checkin_at, checkout_at')
    .eq('user_id', userId)
    .eq('site_id', siteId)
    .eq('kind', kind)
    .order('checkin_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, checkinAt: r.checkin_at, checkoutAt: r.checkout_at }));
}

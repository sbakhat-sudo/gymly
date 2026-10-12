import { useEffect, useState } from 'react';

import { parseResponse } from '@/lib/api/validate';
import { localTime, openStatus } from '@/lib/domain/time';
import { supabase } from '@/lib/supabase/client';
import { BandSchema, type Band, type OpeningHours } from '@/schemas';

export interface SiteStatus {
  name: string;
  timezone: string;
  manuallyOpen: boolean;
  openingHours: OpeningHours[];
  approvalStatus: 'pending_approval' | 'active' | 'suspended';
  capacityReference: number;
}

/** "Open" requires both the manager's manual toggle AND the weekly schedule to allow it. Shared by
 * the Manager's "Situazione" screen and a real (non-guest) Client's Live tab. */
export function isGymOpenNow(site: Pick<SiteStatus, 'timezone' | 'openingHours' | 'manuallyOpen'>, nowMs: number): boolean {
  const local = localTime(new Date(nowMs), site.timezone);
  return openStatus(site.openingHours, local.weekday, local.minutes).open && site.manuallyOpen;
}

/** The real live band: how many client check-ins are open right now at this site, against
 * `get_live_band` (aggregate-only, SECURITY DEFINER — never a raw count, see the migration). */
async function getLiveBand(siteId: string): Promise<Band> {
  const { data, error } = await supabase.rpc('get_live_band', { p_site_id: siteId });
  if (error) throw error;
  return parseResponse(BandSchema, data);
}

const LIVE_POLL_MS = 20_000;
/** Same cadence as the band poll below — one shared constant so the two stay in sync, both here
 *  and conceptually (a Manager/Client never sees the band update on a different rhythm than the
 *  open/closed state it depends on). */
const SITE_STATUS_POLL_MS = LIVE_POLL_MS;

/**
 * The real live band for the Manager's "Situazione" and a real Client's "Live" — polled while the
 * gym is open (no realtime channel in this project's allowed dependency set, same reasoning as
 * `PresenceList`'s "chi c'è ora" poll), `null` the instant it closes.
 */
export function useLiveGymBand(site: SiteStatus | null, siteId: string | null, nowMs: number): Band | null {
  const open = site !== null && isGymOpenNow(site, nowMs);
  const key = open && siteId ? siteId : null;

  const [band, setBand] = useState<Band | null>(null);
  // Render-time "adjust state" (not a setState-in-effect, which this project's React Compiler
  // config rejects): the instant the poll key changes — the gym closes, reopens, or the site
  // changes — any band fetched for the *previous* key is stale and must not linger, so it's
  // cleared in the same render rather than one tick later via an effect.
  const [trackedKey, setTrackedKey] = useState(key);
  if (key !== trackedKey) {
    setTrackedKey(key);
    setBand(null);
  }

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = (): void => {
      getLiveBand(key).then(
        (b) => alive && setBand(b),
        () => undefined
      );
    };
    load();
    const timer = setInterval(load, LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);

  return band;
}

export async function getSiteStatus(siteId: string): Promise<SiteStatus> {
  const { data, error } = await supabase
    .from('sites')
    .select('name, timezone, manually_open, opening_hours, approval_status, capacity_reference')
    .eq('site_id', siteId)
    .single();
  if (error) throw error;
  return {
    name: data.name,
    timezone: data.timezone,
    manuallyOpen: data.manually_open,
    openingHours: data.opening_hours as OpeningHours[],
    approvalStatus: data.approval_status,
    capacityReference: data.capacity_reference,
  };
}

/**
 * `getSiteStatus`, refetched every 20s for as long as the screen is mounted — not just once at
 * mount. Fixes "Situazione"/"Live" getting stuck on "Chiusa ora" after the Manager changes the
 * schedule or flips the open/closed toggle: before this, `site` was fetched once and never again,
 * so a tab left open (or returned to later) kept showing stale opening-hours/manually_open forever.
 *
 * Deliberately NOT gated behind `isGymOpenNow` the way `useLiveGymBand`'s own poll is (see that
 * hook) — gating this one too would mean a gym stuck reading as "closed" could never refetch the
 * one piece of data that would tell it it's actually open again.
 */
export function usePolledSiteStatus(siteId: string | null): { site: SiteStatus | null; loadError: boolean } {
  const [site, setSite] = useState<SiteStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    const load = (): void => {
      getSiteStatus(siteId).then(
        (s) => alive && setSite(s),
        () => alive && setLoadError(true)
      );
    };
    load();
    const timer = setInterval(load, SITE_STATUS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId]);

  return { site, loadError };
}

export interface SiteGeofence {
  lat: number;
  lng: number;
  radius: number;
}

/** `null` when the gym has no geofence configured yet — `get_site_geofence`'s own `where location
 * is not null` filters that row out rather than returning nulls for it. `security invoker` (not
 * definer) on that RPC: `sites` is already readable by any authenticated user, Manager or Admin. */
export async function getSiteGeofence(siteId: string): Promise<SiteGeofence | null> {
  const { data, error } = await supabase.rpc('get_site_geofence', { p_site_id: siteId });
  if (error) throw error;
  return data[0] ?? null;
}

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { getOpenCheckin, realCheckInWithLocation, realCheckOut, realConfirmStillHere, type OpenCheckin } from '@/lib/checkins-api';
import { elapsedSecondsSince, resolveCheckinPhase } from '@/lib/domain/checkin';
import { useAppActive, useNow } from '@/lib/hooks';
import { logger } from '@/lib/logger';

import type { CheckinNotice, UseCheckinResult } from './use-checkin';

// `getCurrentPositionAsync` has no built-in timeout and, per Expo's own docs, "may take some time to
// resolve, especially when you're inside a building" — exactly where every check-in happens. Without
// this, a poor GPS/Wi-Fi fix leaves the button stuck on `busy` forever with zero feedback, which is
// indistinguishable from "non funziona" to whoever is tapping it.
const LOCATION_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location_timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Same shape as `useCheckin` (so `FloatingTabBar` and the Check-in tab can share one instance via
 * `CheckinContext` regardless of which hook backs it), but for a real, approved Client: persisted
 * in the real `checkins` table (`kind: 'client'`) instead of AsyncStorage, so it shows up in the
 * Manager's "chi c'è ora" list. Local reminder notifications are not wired here yet (a later
 * refinement) — `notifOptIn`/`toggleNotify` are inert.
 */
export function useRealCheckin(site: { site_id: string } | null): UseCheckinResult {
  const auth = useAuth();
  const appActive = useAppActive();
  const now = useNow(1000, appActive);

  const [record, setRecord] = useState<OpenCheckin | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CheckinNotice | null>(null);

  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const siteId = site?.site_id ?? null;

  useEffect(() => {
    let alive = true;
    const load = userId && siteId ? getOpenCheckin(userId, siteId, 'client') : Promise.resolve(null);
    load.then(
      (r) => alive && setRecord(r),
      () => alive && setRecord(null)
    );
    return () => {
      alive = false;
    };
  }, [userId, siteId]);

  const phase = record && siteId ? resolveCheckinPhase({ siteId, checkinAt: record.checkinAt, lastConfirmedAt: record.lastConfirmedAt }, now) : null;
  const elapsedSeconds = record && siteId ? elapsedSecondsSince({ siteId, checkinAt: record.checkinAt, lastConfirmedAt: record.lastConfirmedAt }, now) : 0;

  useEffect(() => {
    if (phase === 'autoCheckedOut' && record) {
      void realCheckOut(record.id).then(() => {
        setRecord(null);
        setNotice('autoCheckedOut');
      });
    }
    // `record` intentionally omitted: this effect only reacts to `phase` crossing into autoCheckedOut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function doCheckIn(): Promise<void> {
    if (!userId || !siteId) return;
    setNotice(null);
    setBusy(true);
    try {
      // `Balanced` (network/Wi-Fi assisted) resolves in a couple of seconds even indoors, unlike
      // `High` (GPS-grade) — the server's own geofence tolerance (site radius + 50m) easily absorbs
      // the lower precision, so there's no accuracy trade-off worth a much slower, often-stuck fix.
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
      try {
        const next = await realCheckInWithLocation(siteId, position.coords.latitude, position.coords.longitude, position.mocked ?? false);
        setRecord(next);
      } catch (e) {
        // The RPC's own raised message is already a clear, ready-to-show Italian sentence. Duck-typed
        // instead of `instanceof Error`: supabase-js's PostgrestError doesn't reliably pass that check.
        const message = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : null;
        setNotice(message ? { server: message } : 'generic');
      }
    } catch (e) {
      const timedOut = e instanceof Error && e.message === 'location_timeout';
      logger.error(timedOut ? 'checkin.location_timeout' : 'checkin.location_failed', e);
      setNotice(timedOut ? 'locationTimeout' : 'generic');
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut(): Promise<void> {
    if (!record) return;
    setNotice(null);
    setBusy(true);
    try {
      await realCheckOut(record.id);
      setRecord(null);
    } catch {
      setNotice('generic');
    } finally {
      setBusy(false);
    }
  }

  async function doConfirmStillHere(): Promise<void> {
    if (!record) return;
    setNotice(null);
    const nowIso = await realConfirmStillHere(record.id);
    setRecord({ ...record, lastConfirmedAt: nowIso });
  }

  return {
    loading: record === undefined,
    phase,
    elapsedSeconds,
    notifOptIn: false,
    notifNotice: null,
    notice,
    busy,
    checkIn: doCheckIn,
    checkOut: doCheckOut,
    confirmStillHere: doConfirmStillHere,
    toggleNotify: async () => {},
    dismissNotice: () => setNotice(null),
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Occupancy } from '@/schemas';
import { useClock, useApi } from '@/lib/services-context';
import { toIsoSeconds } from '@/lib/format';
import { storage } from '@/lib/storage';
import { toApiError } from '@/lib/use-async';

/** Foreground refresh period (spec §7: refresh every 60 s, only with the app in the foreground). */
export const REFRESH_MS = 60_000;

export interface OccupancyResult {
  /** Latest validated payload (or the cached one while offline); null when there is none. */
  occupancy: Occupancy | null;
  source: 'network' | 'cache';
  /** No answer for this gym yet (a cached payload may already be on screen meanwhile). */
  loading: boolean;
  /** Why there is no fresh answer: the device is offline, or the response failed validation. */
  failure: 'offline' | 'invalid' | null;
  /** Member-initiated refresh (pull-to-refresh). */
  refresh: () => Promise<void>;
}

interface Snapshot {
  siteId: string;
  occupancy: Occupancy | null;
  source: 'network' | 'cache';
  failure: 'offline' | 'invalid' | null;
  /** false while only the cache-first paint is available. */
  settled: boolean;
}

/**
 * Loads a gym's occupancy: paints the cached payload immediately (fast cold start), asks the
 * network once on open, then every 60 s while `active` (app in foreground AND tab focused).
 * Nothing runs in the background. On a network failure the last cached payload is kept, flagged
 * `source: 'cache'` so the UI labels it explicitly; on a validation failure there is NO data.
 */
export function useOccupancy(siteId: string | undefined, active: boolean, revision: number): OccupancyResult {
  const api = useApi();
  const clock = useClock();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const latest = useRef(0);

  const run = useCallback(async (): Promise<void> => {
    if (!siteId) return;
    const id = ++latest.current;
    const current = (): boolean => id === latest.current;
    try {
      const occupancy = await api.getOccupancy(siteId);
      if (!current()) return;
      setSnapshot({ siteId, occupancy, source: 'network', failure: null, settled: true });
      if (occupancy.status === 'ok') {
        void storage.set('cachedOccupancy', { siteId, savedAt: toIsoSeconds(clock.now()), payload: occupancy });
      }
    } catch (e) {
      if (toApiError(e).code === 'invalid_payload') {
        if (current()) setSnapshot({ siteId, occupancy: null, source: 'network', failure: 'invalid', settled: true });
        return;
      }
      const cached = await storage.get('cachedOccupancy');
      if (!current()) return;
      setSnapshot({
        siteId,
        occupancy: cached && cached.siteId === siteId ? cached.payload : null,
        source: 'cache',
        failure: 'offline',
        settled: true,
      });
    }
  }, [api, clock, siteId]);

  // Cache-first paint: something honest on screen before the network answers.
  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    void storage.get('cachedOccupancy').then((cached) => {
      if (!alive || !cached || cached.siteId !== siteId) return;
      setSnapshot((s) =>
        s && s.siteId === siteId && s.settled ? s : { siteId, occupancy: cached.payload, source: 'network', failure: null, settled: false }
      );
    });
    return () => {
      alive = false;
    };
  }, [siteId]);

  // One call on open, then every 60 s while in the foreground. `revision` = the Demo panel changed something.
  useEffect(() => {
    if (!siteId || !active) return;
    // `run` only sets state after awaiting the API, never synchronously: the rule cannot see through the async call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    const timer = setInterval(() => void run(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      // Deliberately writes the *current* counter (not a captured value) to ignore any request still in flight.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      latest.current++;
    };
  }, [siteId, active, revision, run]);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await run();
    } finally {
      setRefreshing(false);
    }
  }, [run]);

  const own = snapshot && snapshot.siteId === siteId ? snapshot : null;
  return {
    occupancy: own?.occupancy ?? null,
    source: own?.source ?? 'network',
    loading: !own?.settled || refreshing,
    failure: own?.failure ?? null,
    refresh,
  };
}

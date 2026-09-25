import type { Band, NextGreenWindow, Occupancy, ZoneBand } from '@/schemas';

/**
 * Beyond this age even a clearly-labelled last-known band is no longer shown: the app says
 * "not available" instead (spec constraint 2: never serve a stale number as if it were a guess).
 */
export const STALE_CACHE_MAX_AGE_S = 30 * 60;

export type HomeState =
  /** Fresh enough: band shown. `approximate` = medium confidence → rendered with "~". */
  | {
      mode: 'live';
      band: Band;
      approximate: boolean;
      zones: ZoneBand[];
      ageS: number;
      offline: boolean;
      accuracyNote: string | undefined;
      nextGreenWindow: NextGreenWindow | undefined;
    }
  /** Older than the site's staleness limit but still recent: last known band, dimmed and labelled. */
  | { mode: 'stale'; band: Band; ageS: number; offline: boolean }
  /** Low confidence: band hidden, the forecast is shown instead. */
  | { mode: 'forecast'; ageS: number }
  /** No usable data: "Dato non disponibile" (+ forecast for the current slot, labelled as forecast). */
  | { mode: 'unavailable'; reason: 'adapter' | 'invalid' | 'too-old' };

export interface HomeStateInput {
  /** Validated payload, or null if there is none / validation failed. */
  occupancy: Occupancy | null;
  source: 'network' | 'cache';
  nowMs: number;
  stalenessLimitS: number;
}

/**
 * Decides what the Home screen may show, from a payload and the current time (spec §4.5, §7).
 * Pure: the same input always gives the same state, so it is unit-tested exhaustively.
 */
export function resolveHomeState({ occupancy, source, nowMs, stalenessLimitS }: HomeStateInput): HomeState {
  if (!occupancy) return { mode: 'unavailable', reason: 'invalid' };
  if (occupancy.status === 'unavailable') return { mode: 'unavailable', reason: 'adapter' };

  const observedMs = Date.parse(occupancy.observed_at);
  if (Number.isNaN(observedMs)) return { mode: 'unavailable', reason: 'invalid' };

  // A negative age (device clock behind the server) is clamped rather than shown as "in the future".
  const ageS = Math.max(0, Math.floor((nowMs - observedMs) / 1000));
  const offline = source === 'cache';

  if (ageS > STALE_CACHE_MAX_AGE_S) return { mode: 'unavailable', reason: 'too-old' };
  if (occupancy.confidence === 'low') return { mode: 'forecast', ageS };
  if (ageS > stalenessLimitS) return { mode: 'stale', band: occupancy.band, ageS, offline };

  return {
    mode: 'live',
    band: occupancy.band,
    approximate: occupancy.confidence === 'medium',
    zones: occupancy.zones,
    ageS,
    offline,
    accuracyNote: occupancy.accuracy_note,
    nextGreenWindow: occupancy.next_green_window,
  };
}

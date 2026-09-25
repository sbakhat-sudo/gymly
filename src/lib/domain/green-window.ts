import type { ForecastBucket } from '@/schemas';

import { bucketLabel, formatTime } from './time';

export interface GreenWindow {
  from: string;
  /** Exclusive end; `24:00` = midnight. */
  to: string;
  /** The window already includes the current bucket ("free now"). */
  startsNow: boolean;
}

/** A window shorter than this (in 15-min buckets) is a blip, not a reason to change plans. */
export const MIN_GREEN_BUCKETS = 2;

/** Maximal runs of consecutive green buckets, as inclusive `[firstBucket, lastBucket]` pairs. Gaps break a run. */
function greenRuns(buckets: readonly ForecastBucket[]): [number, number][] {
  const sorted = [...buckets].sort((a, b) => a.bucket - b.bucket);
  const runs: [number, number][] = [];
  let start: number | null = null;
  let prev = -2;
  for (const b of sorted) {
    if (b.band === 'green') {
      if (start === null || b.bucket !== prev + 1) {
        if (start !== null) runs.push([start, prev]);
        start = b.bucket;
      }
      prev = b.bucket;
    } else if (start !== null) {
      runs.push([start, prev]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, prev]);
  return runs;
}

/**
 * Next run of consecutive forecast-green buckets that still lies (at least partly) ahead of `nowMinutes`.
 * Gaps (closed hours, missing buckets) break a run. Returns null when there is none today.
 */
export function nextGreenWindow(
  buckets: readonly ForecastBucket[],
  nowMinutes: number,
  minBuckets: number = MIN_GREEN_BUCKETS
): GreenWindow | null {
  const nowBucket = Math.floor(nowMinutes / 15);
  for (const [s, e] of greenRuns(buckets)) {
    if (e < nowBucket) continue;
    const from = Math.max(s, nowBucket);
    if (e - from + 1 < minBuckets) continue;
    return { from: bucketLabel(from), to: formatTime((e + 1) * 15), startsNow: s <= nowBucket };
  }
  return null;
}

/** Every free window of a whole day (no "now" cut-off), for the day detail of the schedule. */
export function allGreenWindows(
  buckets: readonly ForecastBucket[],
  minBuckets: number = MIN_GREEN_BUCKETS
): { from: string; to: string }[] {
  return greenRuns(buckets)
    .filter(([s, e]) => e - s + 1 >= minBuckets)
    .map(([s, e]) => ({ from: bucketLabel(s), to: formatTime((e + 1) * 15) }));
}

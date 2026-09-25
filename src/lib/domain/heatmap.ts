import type { Band, ForecastBucket } from '@/schemas';

import { BAND_ORDER } from './band';

/**
 * Collapses a day's 15-minute forecast into 24 hourly cells for the weekly grid.
 * Each cell takes the BUSIEST band of its buckets (the cautious choice: a member deciding when to
 * come should not be told "free" for an hour that is busy in its second half). `null` = closed.
 */
export function hourlyBands(buckets: readonly ForecastBucket[]): (Band | null)[] {
  const cells: (Band | null)[] = Array.from({ length: 24 }, () => null);
  for (const b of buckets) {
    const hour = Math.floor(b.bucket / 4);
    const current = cells[hour] ?? null;
    if (current === null || BAND_ORDER.indexOf(b.band) > BAND_ORDER.indexOf(current)) cells[hour] = b.band;
  }
  return cells;
}

/** First and last hour with any forecast across the week (rows of the grid); null if the gym is never open. */
export function visibleHours(week: readonly (readonly ForecastBucket[])[]): { first: number; last: number } | null {
  let first = 24;
  let last = -1;
  for (const day of week) {
    for (const b of day) {
      const hour = Math.floor(b.bucket / 4);
      if (hour < first) first = hour;
      if (hour > last) last = hour;
    }
  }
  return last < 0 ? null : { first, last };
}

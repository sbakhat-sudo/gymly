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

/** The most common band across a day's open hours — gives each day pill in the week strip an
 * at-a-glance colour ("was this day generally free, moderate or busy"), separate from the hour-by-
 * hour sparkline next to it. `null` = closed all day (no forecast buckets at all). */
export function dominantBand(buckets: readonly ForecastBucket[]): Band | null {
  const counts: Record<Band, number> = { green: 0, amber: 0, red: 0 };
  for (const band of hourlyBands(buckets)) {
    if (band) counts[band] += 1;
  }
  let best: Band | null = null;
  for (const band of BAND_ORDER) {
    if (counts[band] > 0 && (best === null || counts[band] > counts[best])) best = band;
  }
  return best;
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

/**
 * Mean forecast ratio (`rel`) of each hour, clamped to 0..1; `null` = closed. Used only to size bars
 * (taller = busier) next to the band's colour and shape — never shown as a number.
 */
export function hourlyLoad(buckets: readonly ForecastBucket[]): (number | null)[] {
  const sums = Array.from({ length: 24 }, () => ({ total: 0, n: 0 }));
  for (const b of buckets) {
    const slot = sums[Math.floor(b.bucket / 4)];
    if (slot) {
      slot.total += b.rel;
      slot.n += 1;
    }
  }
  return sums.map((s) => (s.n === 0 ? null : Math.min(1, Math.max(0, s.total / s.n))));
}

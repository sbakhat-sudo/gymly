import type { Band } from '@/schemas';

export interface HourRange {
  /** Inclusive. */
  from: number;
  /** Exclusive. */
  to: number;
}

/**
 * Groups hours (0..23) sharing the same band into contiguous ranges, per band — "quiet 06-09,
 * busy 18-20" instead of a list of 24 individual hours. Input must already be de-duplicated by hour
 * (one band per hour); unlisted hours are simply absent from every range.
 */
export function bandRanges(hours: readonly { hour: number; band: Band }[]): Record<Band, HourRange[]> {
  const sorted = [...hours].sort((a, b) => a.hour - b.hour);
  const result: Record<Band, HourRange[]> = { green: [], amber: [], red: [] };
  let current: { band: Band; from: number; to: number } | null = null;
  for (const h of sorted) {
    if (current && current.band === h.band && h.hour === current.to) {
      current.to = h.hour + 1;
    } else {
      if (current) result[current.band].push({ from: current.from, to: current.to });
      current = { band: h.band, from: h.hour, to: h.hour + 1 };
    }
  }
  if (current) result[current.band].push({ from: current.from, to: current.to });
  return result;
}

/** The widest range for a band, or null if it never occurs — used to keep a day's summary to one tag per band. */
export function widestRange(ranges: readonly HourRange[]): HourRange | null {
  return ranges.reduce<HourRange | null>((best, r) => (!best || r.to - r.from > best.to - best.from ? r : best), null);
}

import type { Band, Weekday } from '@/schemas';

/** One weekday/hour of the gym's real history, averaged over the past weeks (see `get_weekly_stats`). */
export interface HourStat {
  weekday: Weekday;
  hour: number;
  band: Band;
  /** How many past occurrences of this weekday/hour had a check-in. */
  samples: number;
  /** Real occupancy percentage for this weekday/hour, averaged across those occurrences. */
  pct: number;
}

/** An opening window on one day, in minutes since midnight (`end` exclusive; 1440 = closing at midnight). */
export interface OpenWindow {
  start: number;
  end: number;
}

export interface HourAdvice {
  hour: number;
  pct: number;
  band: Band;
  /** How many past occurrences of this weekday/hour had any check-in at all (0 = it was empty every time). */
  samples: number;
}

/**
 * Below this many real observations on a weekday there simply isn't enough history to give advice — the
 * app then says so instead of recommending an hour from a couple of check-ins. (Every hour of a weekday
 * that is absent from the history counts as "empty every time", but only once the weekday has this much
 * real data behind it.)
 */
export const MIN_OBSERVATIONS = 6;

function bandFor(pct: number, greenPct: number, amberPct: number): Band {
  if (pct <= greenPct) return 'green';
  if (pct <= amberPct) return 'amber';
  return 'red';
}

/** Whole hours that fall inside any opening window, in order. An hour counts when the gym is open for all of it. */
export function openHours(windows: readonly OpenWindow[]): number[] {
  const hours = new Set<number>();
  for (const w of windows) {
    for (let h = Math.ceil(w.start / 60); (h + 1) * 60 <= w.end; h++) hours.add(h);
  }
  return [...hours].sort((a, b) => a - b);
}

/**
 * The best hour to go on one weekday, from what really happened on that weekday in the past weeks: the
 * open hour (after `afterMinutes`) that was historically the emptiest — the lowest average occupancy, ties
 * resolved towards the hour with more real history, then the earliest. `null` when the gym has no open
 * hour left, or when the weekday has fewer than `MIN_OBSERVATIONS` real observations to judge by.
 *
 * `alternative` is the next-best hour at least two hours away from the first, so the two suggestions are
 * genuinely different slots rather than neighbours.
 */
export function bestHourToGo(
  stats: readonly HourStat[],
  weekday: Weekday,
  windows: readonly OpenWindow[],
  afterMinutes: number,
  thresholds: { greenPct: number; amberPct: number }
): { best: HourAdvice; alternative: HourAdvice | null } | null {
  const ofDay = stats.filter((s) => s.weekday === weekday);
  if (ofDay.reduce((sum, s) => sum + s.samples, 0) < MIN_OBSERVATIONS) return null;

  const byHour = new Map(ofDay.map((s) => [s.hour, s]));
  const candidates: HourAdvice[] = openHours(windows)
    // The hour must still be ahead: "15:00" is no use at 15:20.
    .filter((h) => h * 60 > afterMinutes)
    .map((h) => {
      const s = byHour.get(h);
      const pct = s?.pct ?? 0;
      return { hour: h, pct, band: s?.band ?? bandFor(pct, thresholds.greenPct, thresholds.amberPct), samples: s?.samples ?? 0 };
    })
    .sort((a, b) => a.pct - b.pct || b.samples - a.samples || a.hour - b.hour);

  const best = candidates[0];
  if (!best) return null;
  const alternative = candidates.find((c) => Math.abs(c.hour - best.hour) >= 2) ?? null;
  return { best, alternative };
}

/** The word the day deserves: which band most of its hours were in, plus its busiest hour. */
export interface DaySummary {
  band: Band;
  peakHour: number;
  peakPct: number;
}

/**
 * How a past day went, in one word — the band most of its real hours fell into (a tie goes to the busier
 * band, so a day split between "moderata" and "affollata" isn't described as the calmer one). `null` for a
 * day with no real hours at all.
 */
export function summarizeDay(hours: readonly { hour: number; pct: number; band: Band }[]): DaySummary | null {
  if (hours.length === 0) return null;
  const counts: Record<Band, number> = { green: 0, amber: 0, red: 0 };
  for (const h of hours) counts[h.band] += 1;

  const order: Band[] = ['red', 'amber', 'green'];
  let band: Band = 'green';
  let most = -1;
  for (const b of order) {
    if (counts[b] > most) {
      band = b;
      most = counts[b];
    }
  }

  const peak = hours.reduce((a, b) => (b.pct > a.pct ? b : a));
  return { band, peakHour: peak.hour, peakPct: peak.pct };
}

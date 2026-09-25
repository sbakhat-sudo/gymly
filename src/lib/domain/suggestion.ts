import type { ForecastBucket, Weekday } from '@/schemas';

export interface Habit {
  weekday: Weekday;
  /** 15-minute arrival bucket, 0..95. */
  bucket: number;
}

/**
 * The member's modal arrival: the weekday they come most often, then that weekday's most
 * frequent 15-minute bucket. Ties resolve to the earliest weekday / bucket (deterministic).
 */
export function modalArrival(arrivals: readonly Habit[]): Habit | null {
  if (arrivals.length === 0) return null;

  const perDay = new Map<number, number>();
  for (const a of arrivals) perDay.set(a.weekday, (perDay.get(a.weekday) ?? 0) + 1);
  let bestDay = -1;
  let bestDayCount = 0;
  for (const [day, count] of [...perDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > bestDayCount) {
      bestDay = day;
      bestDayCount = count;
    }
  }

  const perBucket = new Map<number, number>();
  for (const a of arrivals) {
    if (a.weekday === bestDay) perBucket.set(a.bucket, (perBucket.get(a.bucket) ?? 0) + 1);
  }
  let bestBucket = -1;
  let bestBucketCount = 0;
  for (const [bucket, count] of [...perBucket.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > bestBucketCount) {
      bestBucket = bucket;
      bestBucketCount = count;
    }
  }
  return { weekday: bestDay as Weekday, bucket: bestBucket };
}

export interface PersonalSuggestion {
  habitBucket: number;
  alternativeBucket: number;
  /** How much quieter the alternative is than the habitual slot, whole percent (e.g. 60). */
  lessPercent: number;
}

/** The alternative must be at least this fraction quieter than the habitual slot (spec §4.7). */
export const MIN_REDUCTION = 0.25;

/**
 * Client-side arithmetic, not a model (spec §4.7): given the forecast of the member's habitual day,
 * propose the nearest bucket that is at least 25% quieter. Ties go to the later bucket.
 *
 * No suggestion when the habitual slot is already green (nothing to fix) or unknown.
 */
export function personalSuggestion(
  habitBucket: number,
  dayBuckets: readonly ForecastBucket[],
  minReduction: number = MIN_REDUCTION
): PersonalSuggestion | null {
  const habit = dayBuckets.find((b) => b.bucket === habitBucket);
  if (!habit || habit.band === 'green' || habit.rel <= 0) return null;

  const limit = habit.rel * (1 - minReduction);
  let best: ForecastBucket | null = null;
  for (const b of dayBuckets) {
    if (b.bucket === habitBucket || b.rel > limit) continue;
    if (!best) {
      best = b;
      continue;
    }
    const d = Math.abs(b.bucket - habitBucket);
    const bestD = Math.abs(best.bucket - habitBucket);
    if (d < bestD || (d === bestD && b.bucket > best.bucket)) best = b;
  }
  if (!best) return null;

  return {
    habitBucket,
    alternativeBucket: best.bucket,
    lessPercent: Math.round((1 - best.rel / habit.rel) * 100),
  };
}

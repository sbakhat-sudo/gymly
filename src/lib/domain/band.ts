import type { Band } from '@/schemas';

/** Band thresholds as fractions of `capacity_reference` (spec §4.4). */
export interface BandThresholds {
  /** Below this ratio → green. */
  green: number;
  /** Above this ratio → red. */
  red: number;
}

export const DEFAULT_THRESHOLDS: BandThresholds = { green: 0.4, red: 0.75 };

function assertThresholds(t: BandThresholds): void {
  if (!(t.green > 0 && t.green < t.red && t.red <= 1)) throw new RangeError('invalid band thresholds');
}

/**
 * green  < 0.40 · capacity_reference
 * amber  0.40 – 0.75 (both ends inclusive)
 * red    > 0.75
 */
export function bandFromRatio(ratio: number, thresholds: BandThresholds = DEFAULT_THRESHOLDS): Band {
  assertThresholds(thresholds);
  if (!Number.isFinite(ratio) || ratio < 0) throw new RangeError('invalid ratio');
  if (ratio < thresholds.green) return 'green';
  if (ratio > thresholds.red) return 'red';
  return 'amber';
}

export function bandFromPeople(
  people: number,
  capacityReference: number,
  thresholds: BandThresholds = DEFAULT_THRESHOLDS
): Band {
  if (!(capacityReference > 0)) throw new RangeError('capacity_reference must be positive');
  return bandFromRatio(people / capacityReference, thresholds);
}

/** Visual/semantic order, calmest first. */
export const BAND_ORDER: readonly Band[] = ['green', 'amber', 'red'];

/** One step calmer (green stays green). Used by the mock to differentiate zones. */
export function calmerBand(band: Band): Band {
  const i = BAND_ORDER.indexOf(band);
  return BAND_ORDER[Math.max(0, i - 1)] ?? 'green';
}

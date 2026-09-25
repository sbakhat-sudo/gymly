import type { Confidence } from '@/schemas';

/**
 * How the primary adapter of a site produces its number (spec §3, §4.5).
 * `edge_counter` is bidirectional (in/out events) so it is treated like access control with exits.
 */
export type AdapterClass =
  | 'access_control_exits'
  | 'access_control_entry_only'
  | 'wifi'
  | 'edge_counter'
  | 'manual';

export const HIGH_MAX_STALENESS_S = 120;
export const MEDIUM_MAX_STALENESS_S = 300;
export const MAPE_LOW_THRESHOLD = 0.15;
export const CALIBRATION_MAX_AGE_DAYS = 60;

export interface ConfidenceInput {
  adapterClass: AdapterClass;
  /** Days since the calibration model was last fitted. */
  calibrationAgeDays: number;
  /** Rolling MAPE as a fraction (0.12 = 12%); null when no verified figure exists. */
  mape: number | null;
  /** Age of the latest estimate. */
  stalenessS: number;
  /** Per-site staleness limit (`sites.staleness_limit_s`). */
  stalenessLimitS: number;
  /** Any of the §4.6 anomaly detectors fired. */
  anomaly: boolean;
  /** `operator` = fewer than 90 days of history; confidence is capped at medium (§4.4). */
  capacitySource: 'p95' | 'operator';
}

/**
 * Confidence score per spec §4.5 (server-side logic; lives here so the mock is faithful).
 *
 *  unavailable  anomaly, or estimate older than the site's staleness limit
 *  low          MAPE > 15%, or calibration older than 60 days (model-based sources)
 *  medium       WiFi with MAPE ≤ 15%, entry-only turnstile, staleness < 300 s
 *  high         access control (or edge counter) with exits, staleness < 120 s
 */
export function computeConfidence(input: ConfidenceInput): Confidence {
  if (input.anomaly || input.stalenessS >= input.stalenessLimitS) return 'unavailable';
  if (input.adapterClass === 'manual') return 'low';

  // Sources that need a statistical model (device→people regression, dwell-time reconstruction)
  // must have a fresh, verified calibration. Exact event counters do not.
  const modelBased = input.adapterClass === 'wifi' || input.adapterClass === 'access_control_entry_only';
  if (modelBased) {
    if (input.mape === null || input.mape > MAPE_LOW_THRESHOLD) return 'low';
    if (input.calibrationAgeDays > CALIBRATION_MAX_AGE_DAYS) return 'low';
  }

  if (input.stalenessS >= MEDIUM_MAX_STALENESS_S) return 'low';

  const hasExits = input.adapterClass === 'access_control_exits' || input.adapterClass === 'edge_counter';
  const level: Confidence = hasExits && input.stalenessS < HIGH_MAX_STALENESS_S ? 'high' : 'medium';
  return input.capacitySource === 'operator' ? 'medium' : level;
}

/**
 * Synthetic "typical day" of a gym as a fraction of capacity_reference: morning bump, small lunch
 * bump and a strong evening peak around 19:00 (the "two peak hours" of the spec's motivating case).
 * Deterministic: it is mock data, not a model.
 */
const gauss = (m: number, mu: number, sigma: number): number => Math.exp(-((m - mu) ** 2) / (2 * sigma ** 2));

/** Mondays a bit busier, Fridays quieter. */
const WEEKDAY_FACTOR = [1.05, 1, 1, 1, 0.85] as const;

/** `weekday` 0 = Monday … 6 = Sunday; `minutes` since local midnight. Returns roughly 0.05 … 1.1. */
export function expectedRatio(weekday: number, minutes: number): number {
  let value: number;
  if (weekday <= 4) {
    value =
      0.1 +
      0.5 * gauss(minutes, 8 * 60, 60) +
      0.25 * gauss(minutes, 12 * 60 + 45, 50) +
      0.85 * gauss(minutes, 19 * 60, 55);
    value *= WEEKDAY_FACTOR[weekday] ?? 1;
  } else if (weekday === 5) {
    value = 0.08 + 0.55 * gauss(minutes, 11 * 60, 120);
  } else {
    value = 0.08 + 0.35 * gauss(minutes, 11 * 60 + 30, 90);
  }
  return Math.min(1.2, Math.max(0, value));
}

/** FNV-1a hash of a string → deterministic pseudo-random number in [0, 1). Mock jitter only. */
export function jitter(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

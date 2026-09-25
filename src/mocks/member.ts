import type { PointRule, Reward } from '@/schemas';

/**
 * Default rule set of the spec (§9.2), ORDERED: the first match wins, so the peak window (0 points)
 * sits first and beats the generous weekend rule. Mon–Fri mask = 31, Sat–Sun = 96.
 * Times outside every rule (e.g. Mon–Fri 09:00–14:00 and 17:00–18:00) earn 0.
 */
export const MOCK_POINT_RULES: PointRule[] = [
  { id: 'pr_peak', weekday_mask: 31, from_time: '18:00', to_time: '20:00', points: 0, daily_cap: 1 },
  { id: 'pr_morning', weekday_mask: 31, from_time: '06:00', to_time: '09:00', points: 30, daily_cap: 1 },
  { id: 'pr_afternoon', weekday_mask: 31, from_time: '14:00', to_time: '17:00', points: 50, daily_cap: 1 },
  { id: 'pr_late', weekday_mask: 31, from_time: '21:00', to_time: '24:00', points: 50, daily_cap: 1 },
  { id: 'pr_weekend', weekday_mask: 96, from_time: '00:00', to_time: '24:00', points: 20, daily_cap: 1 },
];

/** Rewards are gym inventory, not money (spec §9.1). `stock: null` = unlimited. Fictional. */
export const MOCK_REWARDS: Reward[] = [
  { id: 'rw_pt', title: 'Seduta di PT in fascia libera', cost: 300, stock: 6 },
  { id: 'rw_guest', title: 'Pass ospite (1 ingresso)', cost: 120, stock: 20 },
  { id: 'rw_discount', title: 'Sconto sul mese successivo', cost: 450, stock: null },
  { id: 'rw_towel', title: 'Asciugamano Gymly', cost: 60, stock: 0 },
];

/** Seed movements, oldest first: `[days ago, delta]`. Sum = 330 points. */
export const MOCK_LEDGER_SEED: readonly (readonly [number, number])[] = [
  [27, 30],
  [24, 50],
  [21, 20],
  [18, 50],
  [15, 30],
  [12, 20],
  [9, 50],
  [6, 30],
  [3, 50],
];

/**
 * The fictional member's arrivals over the last 60 days: mostly Tuesday 18:30 (bucket 74), some
 * Thursday 18:15 and Saturday 10:00. Modal arrival → Tuesday 18:30, the example of the spec (§7).
 */
export function mockArrivals(): { weekday: number; bucket: number }[] {
  const rep = (weekday: number, bucket: number, n: number): { weekday: number; bucket: number }[] =>
    Array.from({ length: n }, () => ({ weekday, bucket }));
  return [...rep(1, 74, 8), ...rep(1, 75, 1), ...rep(3, 73, 4), ...rep(5, 40, 3)];
}

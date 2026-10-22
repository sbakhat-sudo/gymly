import { z } from 'zod';

import { Rfc3339UtcSchema, SiteIdSchema } from '@/schemas';

/**
 * A member's check-in is purely local, on-device state — never a server session. The mock/real
 * API only ever learns "one more / one fewer person at this site" through `checkIn`/`checkOut`
 * (GymlyApi), never who is there or for how long. Kept in AsyncStorage via `src/lib/storage.ts`.
 */
export const CheckinRecordSchema = z.object({
  siteId: SiteIdSchema,
  checkinAt: Rfc3339UtcSchema,
  /** Bumped to "now" whenever the member confirms "sì, sono ancora qui" (restarts the 90-min timer). */
  lastConfirmedAt: Rfc3339UtcSchema,
});
export type CheckinRecord = z.infer<typeof CheckinRecordSchema>;

/** After 90 minutes since check-in (or the last confirmation), ask "sei ancora in palestra?". */
export const STILL_HERE_AFTER_MS = 90 * 60_000;
/** Unanswered for another 15 minutes → check-out happens automatically. */
export const AUTO_CHECKOUT_GRACE_MS = 15 * 60_000;

export type CheckinPhase =
  /** Nothing to ask yet. */
  | 'active'
  /** The 90-minute mark passed: show/replay the "sei ancora qui?" prompt. */
  | 'awaitingConfirmation'
  /** 15 more minutes passed with no answer: the member is checked out. */
  | 'autoCheckedOut';

/**
 * Pure: derives the phase from elapsed time alone (same style as `resolveHomeState`), so a check
 * that runs after the app was closed for a while (or never got the scheduled notification) still
 * reaches the right state — no background timer is required to "catch up".
 */
export function resolveCheckinPhase(record: CheckinRecord, nowMs: number): CheckinPhase {
  const elapsed = nowMs - Date.parse(record.lastConfirmedAt);
  if (elapsed < STILL_HERE_AFTER_MS) return 'active';
  if (elapsed < STILL_HERE_AFTER_MS + AUTO_CHECKOUT_GRACE_MS) return 'awaitingConfirmation';
  return 'autoCheckedOut';
}

/** Whole seconds since check-in for the "tempo trascorso" display — never reset by a confirmation. */
export function elapsedSecondsSince(record: CheckinRecord, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(record.checkinAt)) / 1000));
}

/** "01:24:33" (or "24:33" under an hour) — a stopwatch, not the "X minuti fa" phrasing used elsewhere. */
export function formatStopwatch(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "5:39" — the same clock grouping as `formatStopwatch`, without the seconds: the Manager's
 * presence list shows this inside a small ring (`TimerRing`), where "01:24:33" reads as noise at
 * that size and second-level precision was never the point ("how long has this person been here",
 * not a lap timer). The hour digit always shows, even at 0, so the format never jumps shape between
 * "23" and "1:23" as a session crosses the hour mark. */
export function formatClockMinutes(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** "8.50h" — a closed (or still-open, measured against "now") shift's duration, for the Manager's
 * Coach work-hours register. Decimal hours (not H:MM) to match how a weekly/payroll total is summed. */
export function formatHoursDuration(totalSeconds: number): string {
  return `${(Math.max(0, totalSeconds) / 3600).toFixed(2)}h`;
}

/** "1h 45m" (or "45m" under an hour) — one shift row's duration in the work-hours register, where
 * clock units read more naturally than `formatHoursDuration`'s decimal ("1.75h"). */
export function formatHoursMinutes(totalSeconds: number): string {
  const totalMinutes = Math.round(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Monday 00:00 (local) of the week containing `nowMs`, as epoch ms — weekday index 0=Monday matches
 * the rest of the app's convention, but `Date.getDay()` is 0=Sunday, so it's remapped here. Shared by
 * the Manager's and Coach's work-hours registers to total "this week". */
export function startOfWeek(nowMs: number): number {
  const date = new Date(nowMs);
  date.setHours(0, 0, 0, 0);
  const sinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - sinceMonday);
  return date.getTime();
}

/** A closed (or, with `endIso: null`, still-open against `nowMs`) interval's duration in whole
 * seconds — shared by the Manager's and Coach's work-hours registers. */
export function intervalSeconds(startIso: string, endIso: string | null, nowMs: number): number {
  const end = endIso ? Date.parse(endIso) : nowMs;
  return Math.max(0, (end - Date.parse(startIso)) / 1000);
}

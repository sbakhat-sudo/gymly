import type { OpeningHours, Weekday } from '@/schemas';

export const MINUTES_PER_DAY = 1440;
export const BUCKET_MINUTES = 15;
export const BUCKETS_PER_DAY = 96;

const pad = (n: number): string => String(n).padStart(2, '0');

/** `HH:MM` (or `24:00`) → minutes since midnight. Throws on malformed input. */
export function parseTime(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new RangeError('invalid time');
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > MINUTES_PER_DAY || Number(match[2]) > 59) throw new RangeError('invalid time');
  return minutes;
}

/** Minutes since midnight → `HH:MM` (1440 → `24:00`). */
export function formatTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_PER_DAY) throw new RangeError('invalid minutes');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export const bucketOfMinutes = (minutes: number): number => Math.floor(minutes / BUCKET_MINUTES);
export const bucketStartMinutes = (bucket: number): number => bucket * BUCKET_MINUTES;
export const bucketLabel = (bucket: number): string => formatTime(bucketStartMinutes(bucket));

// ─── Time zones ─────────────────────────────────────────────────────────────────

const WEEKDAY_INDEX: Record<string, Weekday> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

function wallParts(date: Date, timeZone: string): WallParts {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) parts[p.type] = p.value;
  // Tolerate engine differences ("Mon", "Mon.", "MON"): only the first three letters matter.
  const weekday = WEEKDAY_INDEX[(parts.weekday ?? '').slice(0, 3).toLowerCase()];
  if (weekday === undefined) throw new RangeError('unsupported weekday format');
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday,
  };
}

/** Wall-clock reading of an instant in a given IANA zone. */
export interface LocalTime {
  /** 0 = Monday … 6 = Sunday. */
  weekday: Weekday;
  /** Minutes since local midnight (0..1439). */
  minutes: number;
  /** Local calendar date, `YYYY-MM-DD`. */
  dateKey: string;
}

export function localTime(date: Date, timeZone: string): LocalTime {
  const w = wallParts(date, timeZone);
  return {
    weekday: w.weekday,
    minutes: w.hour * 60 + w.minute,
    dateKey: `${w.year}-${pad(w.month)}-${pad(w.day)}`,
  };
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) throw new RangeError('invalid date key');
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function addDays(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The UTC instant at which the wall clock of `timeZone` reads `dateKey` + `minutes`. */
export function zonedTimeToUtc(dateKey: string, minutes: number, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const targetWall = Date.UTC(year, month - 1, day) + minutes * 60_000;
  let guess = targetWall;
  // Two passes converge across DST transitions.
  for (let i = 0; i < 2; i++) {
    const w = wallParts(new Date(guess), timeZone);
    const observedWall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    guess += targetWall - observedWall;
  }
  return new Date(guess);
}

/**
 * Offset (ms) to add to the real clock so that the site's wall clock reads `weekday` at `minutes`
 * (the nearest such moment today or in the coming days). Used by the Demo panel's simulated time.
 */
export function computeSimulationOffsetMs(realNow: Date, weekday: Weekday, minutes: number, timeZone: string): number {
  const local = localTime(realNow, timeZone);
  const daysAhead = (weekday - local.weekday + 7) % 7;
  const target = zonedTimeToUtc(addDays(local.dateKey, daysAhead), minutes, timeZone);
  return target.getTime() - realNow.getTime();
}

// ─── Opening hours ──────────────────────────────────────────────────────────────

export type OpenStatus =
  | { open: true; closesAt: number }
  | { open: false; next: { weekday: Weekday; minutes: number } | null };

/** Whether the site is open at `weekday`/`minutes`, and otherwise when it next opens. */
export function openStatus(hours: readonly OpeningHours[], weekday: Weekday, minutes: number): OpenStatus {
  const intervals = (wd: number): { opens: number; closes: number }[] =>
    hours
      .filter((h) => h.weekday === wd)
      .map((h) => ({ opens: parseTime(h.opens_at), closes: parseTime(h.closes_at) }))
      .sort((a, b) => a.opens - b.opens);

  for (const i of intervals(weekday)) {
    if (minutes >= i.opens && minutes < i.closes) return { open: true, closesAt: i.closes };
  }
  const laterToday = intervals(weekday).find((i) => i.opens > minutes);
  if (laterToday) return { open: false, next: { weekday, minutes: laterToday.opens } };
  for (let offset = 1; offset <= 7; offset++) {
    const wd = ((weekday + offset) % 7) as Weekday;
    const first = intervals(wd)[0];
    if (first) return { open: false, next: { weekday: wd, minutes: first.opens } };
  }
  return { open: false, next: null };
}

/** Whether a 15-minute bucket starts inside an opening interval on `weekday`. */
export function isBucketOpen(hours: readonly OpeningHours[], weekday: Weekday, bucket: number): boolean {
  const start = bucketStartMinutes(bucket);
  return openStatus(hours, weekday, start).open;
}

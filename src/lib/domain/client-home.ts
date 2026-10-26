import type { OpeningHours, Weekday } from '@/schemas';

import type { OpenWindow } from './gym-advice';
import { addDays, localTime, parseTime } from './time';

/** Pure helpers behind a Client's home: the month calendar and today's opening. */

/** 0 = Monday … 6 = Sunday, for a `YYYY-MM-DD` calendar date. */
export function weekdayOfDateKey(dateKey: string): Weekday {
  const day = new Date(`${dateKey}T12:00:00`).getDay(); // 0 = Sunday
  return ((day + 6) % 7) as Weekday;
}

/** The Monday of the week a date falls in. */
export function weekStartKey(dateKey: string): string {
  return addDays(dateKey, -weekdayOfDateKey(dateKey));
}

/** The distinct local calendar days a Client was at the gym (`checkinAt` are RFC 3339 instants). */
export function visitedDays(checkins: readonly { checkinAt: string }[], timeZone: string): Set<string> {
  return new Set(checkins.map((c) => localTime(new Date(c.checkinAt), timeZone).dateKey));
}

export interface CalendarDay {
  dateKey: string;
  day: number;
  visited: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/** The current month as a Monday-first grid: `leading` empty cells, then every day of the month. */
export function monthCalendar(todayKey: string, days: ReadonlySet<string>): { leading: number; days: CalendarDay[] } {
  const [year, month] = todayKey.split('-').map(Number) as [number, number];
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const count = new Date(year, month, 0).getDate();
  const out: CalendarDay[] = [];
  for (let d = 1; d <= count; d++) {
    const dateKey = `${first.slice(0, 8)}${String(d).padStart(2, '0')}`;
    out.push({ dateKey, day: d, visited: days.has(dateKey), isToday: dateKey === todayKey, isFuture: dateKey > todayKey });
  }
  return { leading: weekdayOfDateKey(first), days: out };
}

export type TodayOpening =
  | { kind: 'open'; closesAt: number; minutesLeft: number }
  | { kind: 'opensLater'; opensAt: number; minutesUntil: number }
  | { kind: 'closedForToday'; next: { weekday: Weekday; opensAt: number } | null };

/** One weekday's opening windows in minutes, in order (a day can have several, e.g. a lunch break). */
export function windowsOf(hours: readonly OpeningHours[], weekday: Weekday): OpenWindow[] {
  return hours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: parseTime(h.opens_at), end: parseTime(h.closes_at) }))
    .sort((a, b) => a.start - b.start);
}

/** Where the gym stands against its own schedule right now (the manual open/closed toggle is applied by the caller). */
export function todayOpening(hours: readonly OpeningHours[], weekday: Weekday, nowMinutes: number): TodayOpening {
  const today = windowsOf(hours, weekday);
  const current = today.find((w) => nowMinutes >= w.start && nowMinutes < w.end);
  if (current) return { kind: 'open', closesAt: current.end, minutesLeft: current.end - nowMinutes };
  const later = today.find((w) => w.start > nowMinutes);
  if (later) return { kind: 'opensLater', opensAt: later.start, minutesUntil: later.start - nowMinutes };
  for (let i = 1; i <= 7; i++) {
    const wd = ((weekday + i) % 7) as Weekday;
    const first = windowsOf(hours, wd)[0];
    if (first) return { kind: 'closedForToday', next: { weekday: wd, opensAt: first.start } };
  }
  return { kind: 'closedForToday', next: null };
}

/** A visit as read from the database: when it started and (once finished) ended. */
export interface VisitTimes {
  checkinAt: string;
  checkoutAt: string | null;
}

/** A visit left open for hours is almost always a forgotten check-out: count at most this long per visit. */
export const MAX_VISIT_SECONDS = 5 * 3600;

/** Seconds of one finished visit, capped; an unfinished visit counts as 0 rather than guessing when it ended. */
export function visitSeconds(v: VisitTimes): number {
  if (!v.checkoutAt) return 0;
  const seconds = Math.floor((Date.parse(v.checkoutAt) - Date.parse(v.checkinAt)) / 1000);
  return Math.min(MAX_VISIT_SECONDS, Math.max(0, seconds));
}

/** Total time at the gym across the visits. */
export function totalSeconds(visits: readonly VisitTimes[]): number {
  return visits.reduce((sum, v) => sum + visitSeconds(v), 0);
}

export interface WeekSummary {
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** How many times the member went (check-ins) that week. */
  visits: number;
  seconds: number;
}

/** The last `weeks` weeks (Monday first), oldest first, the current week last — zeros included so the chart has no holes. */
export function weeklySummaries(visits: readonly VisitTimes[], timeZone: string, todayKey: string, weeks = 8): WeekSummary[] {
  const thisWeek = weekStartKey(todayKey);
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: addDays(thisWeek, -7 * i), visits: 0, seconds: 0 });
  const byStart = new Map(out.map((w) => [w.weekStart, w]));
  for (const v of visits) {
    const week = byStart.get(weekStartKey(localTime(new Date(v.checkinAt), timeZone).dateKey));
    if (!week) continue;
    week.visits += 1;
    week.seconds += visitSeconds(v);
  }
  return out;
}

/** Visits per week over the weeks the member has actually been around (from their first visit in `summaries` on). */
export function weeklyAverage(summaries: readonly WeekSummary[]): number | null {
  const first = summaries.findIndex((w) => w.visits > 0);
  if (first < 0) return null;
  const span = summaries.slice(first);
  return span.reduce((sum, w) => sum + w.visits, 0) / span.length;
}

/**
 * The hour the member usually arrives: the most common local arrival hour (ties go to the more recent habit).
 * `null` until there are at least `minVisits` visits — a habit needs more than a couple of data points.
 */
export function usualArrivalHour(visits: readonly VisitTimes[], timeZone: string, minVisits = 3): number | null {
  if (visits.length < minVisits) return null;
  const counts = new Map<number, number>();
  const lastSeen = new Map<number, number>();
  for (const v of visits) {
    const hour = Math.floor(localTime(new Date(v.checkinAt), timeZone).minutes / 60);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
    lastSeen.set(hour, Math.max(lastSeen.get(hour) ?? 0, Date.parse(v.checkinAt)));
  }
  let best: number | null = null;
  for (const [hour, n] of counts) {
    if (best === null) best = hour;
    else {
      const bn = counts.get(best) ?? 0;
      if (n > bn || (n === bn && (lastSeen.get(hour) ?? 0) > (lastSeen.get(best) ?? 0))) best = hour;
    }
  }
  return best;
}

/** The opening windows narrowed to the hours around the member's usual time (2 before, 3 after), so advice stays near what they like. */
export function windowsAroundHour(windows: readonly OpenWindow[], hour: number): OpenWindow[] {
  const from = (hour - 2) * 60;
  const to = (hour + 3) * 60;
  return windows.map((w) => ({ start: Math.max(w.start, from), end: Math.min(w.end, to) })).filter((w) => w.start < w.end);
}

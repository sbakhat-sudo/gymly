import type { Weekday } from '@/schemas';

import { formatTime, type OpenStatus } from './domain/time';

/** RFC 3339 UTC without milliseconds, as in the spec's examples (`2026-09-21T18:04:30Z`). */
export function toIsoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

interface WhenWords {
  weekday: (w: Weekday) => string;
  todayAt: (time: string) => string;
  dayAt: (day: string, time: string) => string;
}

/** "oggi alle 06:00" / "lunedì alle 06:00" for the next opening of a closed gym. */
export function describeNextOpening(status: Extract<OpenStatus, { open: false }>, todayWeekday: Weekday, words: WhenWords): string | null {
  if (!status.next) return null;
  const time = formatTime(status.next.minutes);
  return status.next.weekday === todayWeekday ? words.todayAt(time) : words.dayAt(words.weekday(status.next.weekday), time);
}

/** Short calendar date in the app language ("5 ott" / "Oct 5"). */
export function formatShortDate(lang: 'it' | 'en', iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' }).format(date);
}

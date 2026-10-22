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

type RelativeUnit = 'second' | 'minute' | 'hour' | 'day';

const RELATIVE_UNIT_WORDS: Record<'it' | 'en', Record<RelativeUnit, { singular: string; plural: string }>> = {
  it: {
    second: { singular: 'secondo', plural: 'secondi' },
    minute: { singular: 'minuto', plural: 'minuti' },
    hour: { singular: 'ora', plural: 'ore' },
    day: { singular: 'giorno', plural: 'giorni' },
  },
  en: {
    second: { singular: 'second', plural: 'seconds' },
    minute: { singular: 'minute', plural: 'minutes' },
    hour: { singular: 'hour', plural: 'hours' },
    day: { singular: 'day', plural: 'days' },
  },
};

function relativeLabel(lang: 'it' | 'en', unit: RelativeUnit, n: number, past: boolean): string {
  if (n === 0) return lang === 'it' ? 'ora' : 'now';
  if (unit === 'day' && n === 1) return past ? (lang === 'it' ? 'ieri' : 'yesterday') : lang === 'it' ? 'domani' : 'tomorrow';
  const word = n === 1 ? RELATIVE_UNIT_WORDS[lang][unit].singular : RELATIVE_UNIT_WORDS[lang][unit].plural;
  if (lang === 'it') return past ? `${n} ${word} fa` : `tra ${n} ${word}`;
  return past ? `${n} ${word} ago` : `in ${n} ${word}`;
}

/** "2 ore fa" / "5 minuti fa" — falls back to `formatShortDate` past a week, where "N giorni fa"
 * stops being a useful unit. Deliberately hand-rolled instead of `Intl.RelativeTimeFormat`: that API
 * is missing (not just unsupported — the constructor is `undefined`) on the Hermes build Expo Go
 * ships on some real phones, which crashed this exact screen with "undefined cannot be used as a
 * constructor" — `Intl.DateTimeFormat` (used by `formatShortDate` above) was unaffected. */
export function formatRelativeTime(lang: 'it' | 'en', iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs >= 604800) return formatShortDate(lang, iso);
  const past = seconds <= 0;
  if (abs < 60) return relativeLabel(lang, 'second', Math.round(abs), past);
  if (abs < 3600) return relativeLabel(lang, 'minute', Math.round(abs / 60), past);
  if (abs < 86400) return relativeLabel(lang, 'hour', Math.round(abs / 3600), past);
  return relativeLabel(lang, 'day', Math.round(abs / 86400), past);
}

/** "Lun 19 ott" / "Mon 19 Oct" — a date, capitalised, for the Manager/Coach/Admin top-bar date
 * badge (defaults to today; the badge is also the picker for any other day it's switched to).
 * `Intl.DateTimeFormat` only (see `formatRelativeTime`'s note above on why not
 * `Intl.RelativeTimeFormat`), so this is safe on the same Hermes build that crashed on that API. */
export function formatTodayLabel(lang: 'it' | 'en', date: Date = new Date()): string {
  const raw = new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "Ottobre 2026" / "October 2026", capitalised — the month header of `DateBadge`'s calendar grid. */
export function formatMonthYearLabel(lang: 'it' | 'en', year: number, month: number): string {
  const raw = new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "Lun"/"Mar"/… or "Mon"/"Tue"/… — the 7 short weekday headers, Monday first (this project's
 * weekday convention throughout, see CLAUDE.md), for `DateBadge`'s calendar grid. */
export function shortWeekdayLabels(lang: 'it' | 'en'): string[] {
  const formatter = new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'short' });
  // 2024-01-01 is a Monday — any known Monday works as the anchor to walk forward from.
  return Array.from({ length: 7 }, (_, i) => {
    const raw = formatter.format(new Date(2024, 0, 1 + i));
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace('.', '');
  });
}

/** "HH:MM" in the app language — the clock-time half of a "Oggi • 10:23" footer. */
export function formatClockTime(lang: 'it' | 'en', iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** "Oggi" / "Ieri" / "3 giorni fa", falling back to `formatShortDate` past a week — calendar-day
 * grouping (not elapsed time, unlike `formatRelativeTime`) for a list grouped by day, e.g. "Oggi •
 * 10:23" / "Ieri • 17:45" rows in a feedback/activity list. */
export function formatDayLabel(lang: 'it' | 'en', iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return lang === 'it' ? 'Oggi' : 'Today';
  if (diffDays === 1) return lang === 'it' ? 'Ieri' : 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return lang === 'it' ? `${diffDays} giorni fa` : `${diffDays} days ago`;
  return formatShortDate(lang, iso);
}

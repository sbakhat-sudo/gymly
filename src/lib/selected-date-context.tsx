import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { formatDateKey } from './domain/weekly-goal';

interface SelectedDateContextValue {
  /** Device-local `YYYY-MM-DD`, never a future day — the one calendar day every list on the
   * current role's screens filters its items to. `null` (the default) means no filter at all:
   * lists show everything until the Manager/Coach explicitly picks a day from `DateBadge` — a
   * list that defaulted to "today" used to look empty on first open for anything that doesn't get
   * new items every single day (feedback, work hours), reading as broken rather than just "nothing
   * happened today". */
  dateKey: string | null;
  setDateKey: (key: string | null) => void;
}

const SelectedDateContext = createContext<SelectedDateContextValue | null>(null);

/** One per role layout (alongside `SidebarInsetProvider`/`PageHeaderProvider`), so the day picked
 * from the fixed `DateBadge` (`RoleTopBar`) is the same day every list screen under that layout
 * reads back — a Manager switching from "Segnalazioni" to "Feedback" keeps looking at "ieri"
 * instead of each screen silently resetting to "tutte le date". */
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [dateKey, setDateKey] = useState<string | null>(null);
  const value = useMemo(() => ({ dateKey, setDateKey }), [dateKey]);
  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>;
}

/** Defaults to "no filter" when used outside a `SelectedDateProvider` (e.g. in tests, or a screen
 * that doesn't need it) — same lenient-default convention as `useSidebarInset`, rather than
 * throwing. */
export function useSelectedDate(): SelectedDateContextValue {
  const ctx = useContext(SelectedDateContext);
  return ctx ?? { dateKey: null, setDateKey: () => {} };
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export function addDaysToKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + delta);
  return formatDateKey(date);
}

/** Calendar-month arithmetic for `DateBadge`'s month grid — `{ year, month }` with `month` 0-11,
 * kept separate from `dateKey` (the actually-picked *day*) since the grid can browse a month
 * without a day in it being selected yet. */
export interface MonthKey {
  year: number;
  month: number;
}

export function monthOfDateKey(key: string): MonthKey {
  const [y, m] = key.split('-').map(Number);
  return { year: y ?? 1970, month: (m ?? 1) - 1 };
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function daysInMonth({ year, month }: MonthKey): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 0 = Monday … 6 = Sunday, the 1st of the month falls on — same Monday-start convention as the
 * rest of this project (see CLAUDE.md: "Weekday index: 0 = Monday … 6 = Sunday"). */
export function firstWeekdayOfMonth({ year, month }: MonthKey): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/** `true` for any ISO/RFC3339 timestamp that falls on the given device-local calendar day — or
 * always `true` when `key` is `null` ("no filter"), so every list's own filter can just be
 * `.filter((x) => isOnDateKey(x.createdAt, dateKey))` without a separate null-check each time. */
export function isOnDateKey(iso: string, key: string | null): boolean {
  if (key === null) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return formatDateKey(date) === key;
}

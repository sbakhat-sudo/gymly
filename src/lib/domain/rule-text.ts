import type { PointRule, Weekday } from '@/schemas';

import { weekdayRanges } from './point-rules';

/**
 * Words needed to describe a rule to a member. Passed in (instead of importing i18n) so this stays a
 * pure, unit-tested function usable for both languages.
 */
export interface RuleWords {
  weekdayShort: (weekday: Weekday) => string;
  everyDay: string;
  toClose: string;
}

/** "Lun–Ven", "Sab–Dom", "Lun, Mer", "Ogni giorno". */
export function describeDays(mask: number, words: RuleWords): string {
  if (mask === 127) return words.everyDay;
  return weekdayRanges(mask)
    .map(([a, b]) => (a === b ? words.weekdayShort(a) : `${words.weekdayShort(a)}–${words.weekdayShort(b)}`))
    .join(', ');
}

/** "06:00–09:00", or "21:00–chiusura" when the rule runs until closing (`24:00`). */
export function describeTimes(rule: PointRule, words: RuleWords): string {
  return `${rule.from_time}–${rule.to_time === '24:00' ? words.toClose : rule.to_time}`;
}

/** Whole-day rule ("any time"): 00:00 → closing. */
export function isAnyTime(rule: PointRule): boolean {
  return rule.from_time === '00:00' && rule.to_time === '24:00';
}

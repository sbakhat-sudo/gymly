import type { PointRule, Weekday } from '@/schemas';

import { parseTime } from './time';

export const WEEKDAY_MASK_ALL = 127;

export function weekdayInMask(mask: number, weekday: Weekday): boolean {
  return ((mask >> weekday) & 1) === 1;
}

/** Contiguous weekday ranges in a mask, e.g. Mon–Fri → [[0, 4]]. Used to explain rules to members. */
export function weekdayRanges(mask: number): [Weekday, Weekday][] {
  const ranges: [Weekday, Weekday][] = [];
  let start: number | null = null;
  for (let d = 0; d <= 7; d++) {
    const on = d < 7 && weekdayInMask(mask, d as Weekday);
    if (on && start === null) start = d;
    if (!on && start !== null) {
      ranges.push([start as Weekday, (d - 1) as Weekday]);
      start = null;
    }
  }
  return ranges;
}

/** `from_time` inclusive, `to_time` exclusive (`24:00` = until closing). */
export function ruleMatches(rule: PointRule, weekday: Weekday, minutes: number): boolean {
  return (
    weekdayInMask(rule.weekday_mask, weekday) &&
    minutes >= parseTime(rule.from_time) &&
    minutes < parseTime(rule.to_time)
  );
}

export interface VisitPoints {
  points: number;
  ruleId: string | null;
  /** A rule matched but the member already hit its daily cap. */
  capped: boolean;
}

/**
 * Points for a visit (spec §9.2): the FIRST matching rule wins; no match = 0 points.
 * A rule worth 0 (the peak window) therefore blocks any later, more generous rule.
 * `creditsToday` = how many credits the member already received today (the cap counts credits, not points).
 */
export function pointsForVisit(
  rules: readonly PointRule[],
  weekday: Weekday,
  minutes: number,
  creditsToday: number
): VisitPoints {
  const rule = rules.find((r) => ruleMatches(r, weekday, minutes));
  if (!rule) return { points: 0, ruleId: null, capped: false };
  if (rule.points > 0 && creditsToday >= rule.daily_cap) return { points: 0, ruleId: rule.id, capped: true };
  return { points: rule.points, ruleId: rule.id, capped: false };
}

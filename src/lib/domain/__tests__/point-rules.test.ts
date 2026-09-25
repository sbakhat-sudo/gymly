import { MOCK_POINT_RULES } from '@/mocks/member';
import type { PointRule, Weekday } from '@/schemas';

import { parseTime } from '../time';
import { pointsForVisit, ruleMatches, weekdayInMask, weekdayRanges } from '../point-rules';

const MON = 0 as Weekday;
const SAT = 5 as Weekday;
const SUN = 6 as Weekday;
const at = (h: number, m = 0): number => h * 60 + m;
const pts = (wd: Weekday, minutes: number, credits = 0) => pointsForVisit(MOCK_POINT_RULES, wd, minutes, credits);

describe('default rule set (spec §9.2)', () => {
  it.each([
    ['Mon 07:00 (06–09)', MON, at(7), 30],
    ['Mon 15:00 (14–17)', MON, at(15), 50],
    ['Mon 21:30 (21–close)', MON, at(21, 30), 50],
    ['Fri 22:59 (21–close)', 4 as Weekday, at(22, 59), 50],
    ['Sat 11:00 (weekend any)', SAT, at(11), 20],
    ['Sun 03:00 (weekend any)', SUN, at(3), 20],
  ] as const)('%s → %i points', (_label, wd, minutes, expected) => {
    expect(pts(wd, minutes).points).toBe(expected);
  });

  it('peak hours earn 0 and the peak rule wins (first match), not "no rule"', () => {
    expect(pts(MON, at(18, 30))).toEqual({ points: 0, ruleId: 'pr_peak', capped: false });
    expect(pts(MON, at(18))).toMatchObject({ points: 0, ruleId: 'pr_peak' });
    expect(pts(MON, at(19, 59))).toMatchObject({ points: 0, ruleId: 'pr_peak' });
  });

  it('times covered by no rule earn 0 with no rule id (e.g. Mon–Fri 09–14 and 17–18)', () => {
    expect(pts(MON, at(10))).toEqual({ points: 0, ruleId: null, capped: false });
    expect(pts(MON, at(17, 30))).toEqual({ points: 0, ruleId: null, capped: false });
    expect(pts(MON, at(20, 30))).toEqual({ points: 0, ruleId: null, capped: false });
  });

  it('range ends are exclusive, starts inclusive', () => {
    expect(pts(MON, at(6)).points).toBe(30);
    expect(pts(MON, at(5, 59)).points).toBe(0);
    expect(pts(MON, at(8, 59)).points).toBe(30);
    expect(pts(MON, at(9)).points).toBe(0);
    expect(pts(MON, at(20)).points).toBe(0);
  });

  it('the weekend rule is not shadowed by the Mon–Fri peak', () => {
    expect(pts(SAT, at(19)).points).toBe(20);
  });
});

describe('daily cap', () => {
  it('a second credit on the same day earns nothing and reports it as capped', () => {
    expect(pts(MON, at(7), 1)).toEqual({ points: 0, ruleId: 'pr_morning', capped: true });
  });

  it('a first credit is allowed', () => {
    expect(pts(MON, at(7), 0).points).toBe(30);
  });

  it('honours caps above 1', () => {
    const rules: PointRule[] = [{ id: 'r', weekday_mask: 127, from_time: '00:00', to_time: '24:00', points: 10, daily_cap: 2 }];
    expect(pointsForVisit(rules, MON, at(9), 1).points).toBe(10);
    expect(pointsForVisit(rules, MON, at(9), 2).capped).toBe(true);
  });

  it('a 0-point (peak) match is never reported as capped', () => {
    expect(pts(MON, at(18, 30), 5)).toEqual({ points: 0, ruleId: 'pr_peak', capped: false });
  });
});

describe('rule ordering', () => {
  it('the first matching rule wins, even if a later one is more generous', () => {
    const rules: PointRule[] = [
      { id: 'a', weekday_mask: 127, from_time: '10:00', to_time: '12:00', points: 5, daily_cap: 1 },
      { id: 'b', weekday_mask: 127, from_time: '00:00', to_time: '24:00', points: 99, daily_cap: 1 },
    ];
    expect(pointsForVisit(rules, MON, at(11), 0).points).toBe(5);
    expect(pointsForVisit(rules, MON, at(13), 0).points).toBe(99);
  });
});

describe('weekday masks', () => {
  it('bit i = weekday i (Monday = 0)', () => {
    expect(weekdayInMask(31, MON)).toBe(true);
    expect(weekdayInMask(31, 4)).toBe(true);
    expect(weekdayInMask(31, SAT)).toBe(false);
    expect(weekdayInMask(96, SAT)).toBe(true);
    expect(weekdayInMask(96, SUN)).toBe(true);
  });

  it('describes contiguous ranges for member-facing text', () => {
    expect(weekdayRanges(31)).toEqual([[0, 4]]);
    expect(weekdayRanges(96)).toEqual([[5, 6]]);
    expect(weekdayRanges(127)).toEqual([[0, 6]]);
    expect(weekdayRanges(0b0000101)).toEqual([[0, 0], [2, 2]]);
    expect(weekdayRanges(0)).toEqual([]);
  });

  it('ruleMatches respects the mask', () => {
    const [weekdayRule] = MOCK_POINT_RULES.filter((r) => r.id === 'pr_morning');
    expect(weekdayRule && ruleMatches(weekdayRule, SAT, at(7))).toBe(false);
  });
});

it('every mock rule time is well-formed', () => {
  for (const r of MOCK_POINT_RULES) {
    expect(parseTime(r.from_time)).toBeLessThan(parseTime(r.to_time));
  }
});

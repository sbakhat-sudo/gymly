import type { OpeningHours } from '@/schemas';

import { MAX_VISIT_SECONDS, monthCalendar, todayOpening, totalSeconds, usualArrivalHour, visitSeconds, visitedDays, weekdayOfDateKey, weeklyAverage, weeklySummaries, windowsAroundHour, windowsOf } from '../client-home';

describe('day helpers', () => {
  it('knows the weekday of a date (Monday = 0)', () => {
    expect(weekdayOfDateKey('2026-10-26')).toBe(0);
    expect(weekdayOfDateKey('2026-11-01')).toBe(6);
  });

  it('turns visits into distinct local days', () => {
    const days = visitedDays([{ checkinAt: '2026-10-26T08:00:00Z' }, { checkinAt: '2026-10-26T17:00:00Z' }, { checkinAt: '2026-10-28T08:00:00Z' }], 'Europe/Rome');
    expect([...days].sort()).toEqual(['2026-10-26', '2026-10-28']);
  });
});

describe('monthCalendar', () => {
  it('lays the month out Monday-first and marks visits, today and the future', () => {
    const cal = monthCalendar('2026-10-15', new Set(['2026-10-02', '2026-10-15']));
    expect(cal.leading).toBe(3); // 1 October 2026 is a Thursday
    expect(cal.days).toHaveLength(31);
    expect(cal.days[1]).toMatchObject({ dateKey: '2026-10-02', visited: true, isToday: false, isFuture: false });
    expect(cal.days[14]).toMatchObject({ isToday: true, visited: true });
    expect(cal.days[20]).toMatchObject({ isFuture: true, visited: false });
  });
});

describe('todayOpening', () => {
  const hours: OpeningHours[] = [
    { weekday: 0, opens_at: '07:00', closes_at: '12:00' },
    { weekday: 0, opens_at: '15:00', closes_at: '22:00' },
    { weekday: 2, opens_at: '07:00', closes_at: '22:00' },
  ];

  it('reads the open window and the time left', () => {
    expect(todayOpening(hours, 0, 9 * 60)).toEqual({ kind: 'open', closesAt: 12 * 60, minutesLeft: 180 });
  });

  it('tells when it opens again later today (a lunch break)', () => {
    expect(todayOpening(hours, 0, 13 * 60)).toEqual({ kind: 'opensLater', opensAt: 15 * 60, minutesUntil: 120 });
  });

  it('finds the next open day after closing', () => {
    expect(todayOpening(hours, 0, 23 * 60)).toEqual({ kind: 'closedForToday', next: { weekday: 2, opensAt: 7 * 60 } });
  });

  it('has no next day when the gym never opens', () => {
    expect(todayOpening([], 0, 600)).toEqual({ kind: 'closedForToday', next: null });
  });

  it('sorts a day\'s windows', () => {
    expect(windowsOf(hours, 0)).toEqual([
      { start: 420, end: 720 },
      { start: 900, end: 1320 },
    ]);
  });
});

describe('visit statistics', () => {
  const v = (day: string, hour: number, minutes: number | null) => ({
    checkinAt: `${day}T${String(hour).padStart(2, '0')}:00:00Z`,
    checkoutAt: minutes === null ? null : new Date(Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`) + minutes * 60_000).toISOString(),
  });

  it('caps a forgotten check-out and ignores a visit still open', () => {
    expect(visitSeconds(v('2026-10-26', 9, 60))).toBe(3600);
    expect(visitSeconds(v('2026-10-26', 9, 900))).toBe(MAX_VISIT_SECONDS);
    expect(visitSeconds(v('2026-10-26', 9, null))).toBe(0);
    expect(totalSeconds([v('2026-10-26', 9, 60), v('2026-10-27', 9, 30)])).toBe(5400);
  });

  it('builds the last weeks oldest first with zeros included', () => {
    const visits = [v('2026-10-26', 9, 60), v('2026-10-28', 9, 60), v('2026-10-19', 9, 60)];
    const weeks = weeklySummaries(visits, 'UTC', '2026-10-29', 3);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    expect(weeks.map((w) => w.visits)).toEqual([0, 1, 2]);
    expect(weeks[2]?.seconds).toBe(7200);
  });

  it('averages from the first week with a visit', () => {
    const weeks = weeklySummaries([v('2026-10-19', 9, 60), v('2026-10-26', 9, 60), v('2026-10-27', 9, 60)], 'UTC', '2026-10-29', 4);
    expect(weeklyAverage(weeks)).toBeCloseTo(1.5);
    expect(weeklyAverage(weeklySummaries([], 'UTC', '2026-10-29', 4))).toBeNull();
  });

  it('finds the usual arrival hour, needing a few visits first', () => {
    expect(usualArrivalHour([v('2026-10-26', 18, 60), v('2026-10-27', 18, 60)], 'UTC')).toBeNull();
    expect(usualArrivalHour([v('2026-10-26', 18, 60), v('2026-10-27', 18, 60), v('2026-10-28', 7, 60)], 'UTC')).toBe(18);
  });

  it('narrows the opening windows around a usual hour', () => {
    expect(windowsAroundHour([{ start: 7 * 60, end: 22 * 60 }], 18)).toEqual([{ start: 16 * 60, end: 21 * 60 }]);
    expect(windowsAroundHour([{ start: 7 * 60, end: 12 * 60 }], 18)).toEqual([]);
  });
});

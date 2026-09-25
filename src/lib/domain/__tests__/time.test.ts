import { MOCK_SITES } from '@/mocks/sites';
import type { OpeningHours } from '@/schemas';

import {
  addDays,
  bucketLabel,
  bucketOfMinutes,
  computeSimulationOffsetMs,
  formatTime,
  localTime,
  openStatus,
  parseTime,
  zonedTimeToUtc,
} from '../time';

describe('time helpers', () => {
  it('parseTime / formatTime round-trip, including 24:00', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('18:30')).toBe(1110);
    expect(parseTime('24:00')).toBe(1440);
    expect(formatTime(1110)).toBe('18:30');
    expect(formatTime(1440)).toBe('24:00');
  });

  it('rejects malformed input', () => {
    expect(() => parseTime('9:00')).toThrow(RangeError);
    expect(() => parseTime('12:75')).toThrow(RangeError);
    expect(() => parseTime('25:00')).toThrow(RangeError);
    expect(() => formatTime(-1)).toThrow(RangeError);
    expect(() => formatTime(1441)).toThrow(RangeError);
  });

  it('buckets are 15 minutes', () => {
    expect(bucketOfMinutes(1110)).toBe(74);
    expect(bucketOfMinutes(1124)).toBe(74);
    expect(bucketOfMinutes(1125)).toBe(75);
    expect(bucketLabel(74)).toBe('18:30');
    expect(bucketLabel(0)).toBe('00:00');
    expect(bucketLabel(95)).toBe('23:45');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('time zones (site-local wall clock)', () => {
  it('Europe/Rome in summer (CEST, UTC+2)', () => {
    expect(localTime(new Date('2026-09-21T16:30:00Z'), 'Europe/Rome')).toEqual({
      weekday: 0,
      minutes: 18 * 60 + 30,
      dateKey: '2026-09-21',
    });
  });

  it('Europe/Rome in winter (CET, UTC+1)', () => {
    expect(localTime(new Date('2026-12-07T17:30:00Z'), 'Europe/Rome')).toMatchObject({ weekday: 0, minutes: 18 * 60 + 30 });
  });

  it('crosses midnight into the next local day', () => {
    expect(localTime(new Date('2026-09-21T22:30:00Z'), 'Europe/Rome')).toEqual({
      weekday: 1,
      minutes: 30,
      dateKey: '2026-09-22',
    });
  });

  it('local midnight is 00:xx, never 24:xx', () => {
    expect(localTime(new Date('2026-09-20T22:00:00Z'), 'Europe/Rome').minutes).toBe(0);
  });

  it('zonedTimeToUtc inverts localTime, across the autumn DST change (2026-10-25)', () => {
    expect(zonedTimeToUtc('2026-09-21', 18 * 60 + 30, 'Europe/Rome').toISOString()).toBe('2026-09-21T16:30:00.000Z');
    expect(zonedTimeToUtc('2026-10-24', 12 * 60, 'Europe/Rome').toISOString()).toBe('2026-10-24T10:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-25', 12 * 60, 'Europe/Rome').toISOString()).toBe('2026-10-25T11:00:00.000Z');
  });

  it('computeSimulationOffsetMs targets the next occurrence of a weekday/time in the site zone', () => {
    const realNow = new Date('2026-09-21T10:00:00Z'); // Monday 12:00 in Rome
    const offset = computeSimulationOffsetMs(realNow, 1, 18 * 60 + 30, 'Europe/Rome'); // Tuesday 18:30
    const simulated = new Date(realNow.getTime() + offset);
    expect(localTime(simulated, 'Europe/Rome')).toEqual({ weekday: 1, minutes: 18 * 60 + 30, dateKey: '2026-09-22' });
  });

  it('the same weekday means today (possibly earlier), not a week ahead', () => {
    const realNow = new Date('2026-09-21T10:00:00Z');
    const offset = computeSimulationOffsetMs(realNow, 0, 8 * 60, 'Europe/Rome');
    expect(offset).toBe(-4 * 3_600_000);
  });
});

describe('openStatus', () => {
  const [centro, riviera] = MOCK_SITES;
  const hoursA = centro?.opening_hours ?? [];
  const hoursB = riviera?.opening_hours ?? [];

  it('open inside an interval, reporting the closing time', () => {
    expect(openStatus(hoursA, 0, 12 * 60)).toEqual({ open: true, closesAt: 23 * 60 });
    expect(openStatus(hoursA, 0, 6 * 60)).toEqual({ open: true, closesAt: 23 * 60 });
  });

  it('closing time is exclusive', () => {
    expect(openStatus(hoursA, 0, 23 * 60)).toEqual({ open: false, next: { weekday: 1, minutes: 6 * 60 } });
  });

  it('before opening → reopens later today', () => {
    expect(openStatus(hoursA, 0, 5 * 60)).toEqual({ open: false, next: { weekday: 0, minutes: 6 * 60 } });
  });

  it('after closing on Saturday → reopens Sunday', () => {
    expect(openStatus(hoursA, 5, 20 * 60)).toEqual({ open: false, next: { weekday: 6, minutes: 9 * 60 } });
  });

  it('skips closed days (site B is closed all Sunday)', () => {
    expect(openStatus(hoursB, 5, 18 * 60)).toEqual({ open: false, next: { weekday: 0, minutes: 7 * 60 } });
    expect(openStatus(hoursB, 6, 10 * 60)).toEqual({ open: false, next: { weekday: 0, minutes: 7 * 60 } });
  });

  it('a site with no hours is never open and has no next opening', () => {
    const none: OpeningHours[] = [];
    expect(openStatus(none, 2, 600)).toEqual({ open: false, next: null });
  });

  it('handles a split day (two intervals)', () => {
    const split: OpeningHours[] = [
      { weekday: 0, opens_at: '07:00', closes_at: '12:00' },
      { weekday: 0, opens_at: '16:00', closes_at: '22:00' },
    ];
    expect(openStatus(split, 0, 13 * 60)).toEqual({ open: false, next: { weekday: 0, minutes: 16 * 60 } });
    expect(openStatus(split, 0, 17 * 60)).toEqual({ open: true, closesAt: 22 * 60 });
  });
});

import { AUTO_CHECKOUT_GRACE_MS, STILL_HERE_AFTER_MS, elapsedSecondsSince, formatStopwatch, resolveCheckinPhase, type CheckinRecord } from '../checkin';

const NOW = Date.parse('2026-09-21T18:00:00Z');
const minutesAgo = (m: number): string => new Date(NOW - m * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

const record = (checkinAgoMin: number, confirmedAgoMin: number = checkinAgoMin): CheckinRecord => ({
  siteId: 'st_demo_centro',
  checkinAt: minutesAgo(checkinAgoMin),
  lastConfirmedAt: minutesAgo(confirmedAgoMin),
});

describe('resolveCheckinPhase', () => {
  it('is "active" right after check-in', () => {
    expect(resolveCheckinPhase(record(0), NOW)).toBe('active');
  });

  it('is "active" just under 90 minutes since the last confirmation', () => {
    expect(resolveCheckinPhase(record(89), NOW)).toBe('active');
  });

  it('is "awaitingConfirmation" at and after the 90-minute mark', () => {
    expect(resolveCheckinPhase(record(90), NOW)).toBe('awaitingConfirmation');
    expect(resolveCheckinPhase(record(104), NOW)).toBe('awaitingConfirmation');
  });

  it('is "autoCheckedOut" 105 minutes after the last confirmation', () => {
    expect(resolveCheckinPhase(record(105), NOW)).toBe('autoCheckedOut');
  });

  it('a "sì, sono ancora qui" confirmation restarts the 90-minute window without resetting the elapsed clock', () => {
    // Checked in 100 minutes ago but confirmed 5 minutes ago: back to "active".
    const r = record(100, 5);
    expect(resolveCheckinPhase(r, NOW)).toBe('active');
    expect(elapsedSecondsSince(r, NOW)).toBe(100 * 60);
  });

  it('constants add up to the spec’s 90 + 15 minutes', () => {
    expect(STILL_HERE_AFTER_MS).toBe(90 * 60_000);
    expect(AUTO_CHECKOUT_GRACE_MS).toBe(15 * 60_000);
  });
});

describe('elapsedSecondsSince', () => {
  it('counts from checkinAt, never negative', () => {
    expect(elapsedSecondsSince(record(0), NOW)).toBe(0);
    expect(elapsedSecondsSince(record(5), NOW)).toBe(300);
    expect(elapsedSecondsSince(record(0), NOW - 10_000)).toBe(0); // "now" before checkinAt clamps to 0
  });
});

describe('formatStopwatch', () => {
  it('renders mm:ss under an hour', () => {
    expect(formatStopwatch(0)).toBe('00:00');
    expect(formatStopwatch(65)).toBe('01:05');
    expect(formatStopwatch(3599)).toBe('59:59');
  });

  it('renders hh:mm:ss from an hour on', () => {
    expect(formatStopwatch(3600)).toBe('01:00:00');
    expect(formatStopwatch(5025)).toBe('01:23:45');
  });
});

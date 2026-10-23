import { bestHourToGo, MIN_OBSERVATIONS, openHours, summarizeDay, type HourStat, type OpenWindow } from '../gym-advice';

const THRESHOLDS = { greenPct: 40, amberPct: 75 };
const DAY: OpenWindow[] = [{ start: 6 * 60, end: 22 * 60 }]; // 06:00–22:00

function stat(hour: number, pct: number, samples = 4, weekday = 3): HourStat {
  return { weekday: weekday as HourStat['weekday'], hour, pct, samples, band: pct <= 40 ? 'green' : pct <= 75 ? 'amber' : 'red' };
}

describe('openHours', () => {
  it('lists the whole hours inside the opening windows', () => {
    expect(openHours([{ start: 9 * 60, end: 12 * 60 }])).toEqual([9, 10, 11]);
  });

  it('does not count an hour the gym only partly covers', () => {
    expect(openHours([{ start: 9 * 60 + 30, end: 11 * 60 + 30 }])).toEqual([10]);
  });

  it('merges several windows in order, and handles closing at midnight', () => {
    expect(openHours([{ start: 18 * 60, end: 24 * 60 }, { start: 7 * 60, end: 9 * 60 }])).toEqual([7, 8, 18, 19, 20, 21, 22, 23]);
  });
});

describe('bestHourToGo', () => {
  const busyDay = [stat(7, 60), stat(8, 80), stat(12, 50), stat(15, 10), stat(18, 90), stat(19, 85)];

  it('recommends the emptiest hour that is still ahead', () => {
    const r = bestHourToGo(busyDay, 3, DAY, 14 * 60, THRESHOLDS);
    // Every open hour with no history counts as empty, so an empty one beats 15:00's 10% — and ties go to the
    // hour with more real history, then the earliest. 15:00 has history, so among the 0% hours the earliest wins.
    expect(r?.best.pct).toBe(0);
    expect(r?.best.hour).toBeGreaterThan(14);
  });

  it('never suggests an hour that has already started', () => {
    const r = bestHourToGo(busyDay, 3, DAY, 15 * 60 + 20, THRESHOLDS);
    expect(r?.best.hour).toBeGreaterThan(15);
  });

  it('prefers a quiet hour with real history over an unobserved one only when the unobserved is not emptier', () => {
    const everyHour = Array.from({ length: 16 }, (_, i) => stat(6 + i, 50 + (i % 3) * 10));
    everyHour[9] = stat(15, 12);
    const r = bestHourToGo(everyHour, 3, DAY, 8 * 60, THRESHOLDS);
    expect(r?.best.hour).toBe(15);
    expect(r?.best.pct).toBe(12);
    expect(r?.best.band).toBe('green');
  });

  it('offers a second suggestion at least two hours from the first', () => {
    const everyHour = Array.from({ length: 16 }, (_, i) => stat(6 + i, 60));
    everyHour[9] = stat(15, 10);
    everyHour[10] = stat(16, 12);
    everyHour[4] = stat(10, 20);
    const r = bestHourToGo(everyHour, 3, DAY, 5 * 60, THRESHOLDS);
    expect(r?.best.hour).toBe(15);
    expect(r?.alternative?.hour).toBe(10);
  });

  it('says nothing when the weekday has too little real history', () => {
    const few = [stat(15, 10, MIN_OBSERVATIONS - 1)];
    expect(bestHourToGo(few, 3, DAY, 8 * 60, THRESHOLDS)).toBeNull();
  });

  it('ignores the history of other weekdays', () => {
    const otherDay = [stat(15, 5, 20, 1)];
    expect(bestHourToGo(otherDay, 3, DAY, 8 * 60, THRESHOLDS)).toBeNull();
  });

  it('returns null once no open hour is left today', () => {
    expect(bestHourToGo(busyDay, 3, DAY, 21 * 60 + 30, THRESHOLDS)).toBeNull();
  });
});

describe('summarizeDay', () => {
  it('is null for a day with no real hours', () => {
    expect(summarizeDay([])).toBeNull();
  });

  it('names the band most hours were in, and the busiest hour', () => {
    const r = summarizeDay([
      { hour: 7, pct: 10, band: 'green' },
      { hour: 8, pct: 20, band: 'green' },
      { hour: 18, pct: 90, band: 'red' },
    ]);
    expect(r).toEqual({ band: 'green', peakHour: 18, peakPct: 90 });
  });

  it('gives a tie to the busier band', () => {
    const r = summarizeDay([
      { hour: 9, pct: 50, band: 'amber' },
      { hour: 18, pct: 90, band: 'red' },
    ]);
    expect(r?.band).toBe('red');
  });
});

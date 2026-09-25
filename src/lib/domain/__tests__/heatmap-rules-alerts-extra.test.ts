import { MOCK_POINT_RULES } from '@/mocks/member';
import type { Band, ForecastBucket, Weekday } from '@/schemas';

import { ALERT_PRESETS, isValidAlertWindow, presetOf, QUIET_START_MIN } from '../alerts';
import { allGreenWindows } from '../green-window';
import { hourlyBands, visibleHours } from '../heatmap';
import { describeDays, describeTimes, isAnyTime, type RuleWords } from '../rule-text';
import { bucketLabel, parseTime } from '../time';

const b = (bucket: number, band: Band): ForecastBucket => ({
  bucket,
  time: bucketLabel(bucket),
  band,
  rel: band === 'green' ? 0.2 : band === 'amber' ? 0.55 : 0.9,
});

describe('allGreenWindows', () => {
  it('returns every free window of the day, in order, ignoring blips shorter than two buckets', () => {
    const day = [
      b(28, 'green'), // lone blip
      b(29, 'red'),
      b(40, 'green'),
      b(41, 'green'),
      b(42, 'green'),
      b(43, 'amber'),
      b(80, 'green'),
      b(81, 'green'),
    ];
    expect(allGreenWindows(day)).toEqual([
      { from: '10:00', to: '10:45' },
      { from: '20:00', to: '20:30' },
    ]);
  });

  it('is empty for a closed or fully busy day', () => {
    expect(allGreenWindows([])).toEqual([]);
    expect(allGreenWindows([b(72, 'red'), b(73, 'amber')])).toEqual([]);
  });

  it('a window through closing time ends at 24:00', () => {
    expect(allGreenWindows([b(94, 'green'), b(95, 'green')])).toEqual([{ from: '23:30', to: '24:00' }]);
  });
});

describe('hourlyBands (weekly grid cells)', () => {
  it('takes the busiest band of the hour (cautious)', () => {
    const cells = hourlyBands([b(72, 'green'), b(73, 'green'), b(74, 'red'), b(75, 'amber')]); // 18:00–18:45
    expect(cells[18]).toBe('red');
  });

  it('an hour with only green buckets is green; hours without buckets are closed (null)', () => {
    const cells = hourlyBands([b(84, 'green'), b(85, 'green')]);
    expect(cells[21]).toBe('green');
    expect(cells[20]).toBeNull();
    expect(cells).toHaveLength(24);
  });

  it('visibleHours spans the whole week, and is null when never open', () => {
    expect(visibleHours([[b(24, 'green')], [], [b(91, 'red')]])).toEqual({ first: 6, last: 22 });
    expect(visibleHours([[], []])).toBeNull();
  });
});

describe('rule text (member-facing wording)', () => {
  const words: RuleWords = {
    weekdayShort: (w: Weekday) => ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][w] ?? '?',
    everyDay: 'Ogni giorno',
    toClose: 'chiusura',
  };

  it('describes day masks', () => {
    expect(describeDays(31, words)).toBe('Lun–Ven');
    expect(describeDays(96, words)).toBe('Sab–Dom');
    expect(describeDays(127, words)).toBe('Ogni giorno');
    expect(describeDays(0b0000101, words)).toBe('Lun, Mer');
  });

  it('describes times, using "chiusura" for a rule that runs until closing', () => {
    const [peak, morning, , late, weekend] = MOCK_POINT_RULES;
    expect(peak && describeTimes(peak, words)).toBe('18:00–20:00');
    expect(morning && describeTimes(morning, words)).toBe('06:00–09:00');
    expect(late && describeTimes(late, words)).toBe('21:00–chiusura');
    expect(weekend && isAnyTime(weekend)).toBe(true);
    expect(morning && isAnyTime(morning)).toBe(false);
  });
});

describe('alert presets', () => {
  it('every preset is a valid window that ends before the 22:00 quiet hours', () => {
    for (const w of Object.values(ALERT_PRESETS)) {
      expect(isValidAlertWindow(w)).toBe(true);
      expect(parseTime(w.to)).toBeLessThanOrEqual(QUIET_START_MIN);
    }
  });

  it('presetOf recognises stored windows', () => {
    expect(presetOf({ from: '17:00', to: '21:00' })).toBe('evening');
    expect(presetOf({ from: '06:00', to: '09:00' })).toBe('morning');
    expect(presetOf({ from: '07:00', to: '09:00' })).toBeNull();
  });
});

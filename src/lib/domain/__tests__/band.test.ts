import { bandFromPeople, bandFromRatio, calmerBand } from '../band';

describe('bandFromRatio (spec §4.4: green < 0.40, amber 0.40–0.75, red > 0.75)', () => {
  it.each([
    [0, 'green'],
    [0.39, 'green'],
    [0.3999, 'green'],
    [0.4, 'amber'],
    [0.55, 'amber'],
    [0.75, 'amber'],
    [0.7501, 'red'],
    [0.94, 'red'],
    [1.6, 'red'],
  ] as const)('ratio %s → %s', (ratio, expected) => {
    expect(bandFromRatio(ratio)).toBe(expected);
  });

  it('honours per-site threshold overrides', () => {
    expect(bandFromRatio(0.5, { green: 0.6, red: 0.9 })).toBe('green');
    expect(bandFromRatio(0.8, { green: 0.6, red: 0.9 })).toBe('amber');
    expect(bandFromRatio(0.95, { green: 0.6, red: 0.9 })).toBe('red');
  });

  it('rejects invalid input instead of guessing', () => {
    expect(() => bandFromRatio(-0.1)).toThrow(RangeError);
    expect(() => bandFromRatio(Number.NaN)).toThrow(RangeError);
    expect(() => bandFromRatio(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => bandFromRatio(0.5, { green: 0.8, red: 0.5 })).toThrow(RangeError);
    expect(() => bandFromRatio(0.5, { green: 0, red: 0.5 })).toThrow(RangeError);
  });
});

describe('bandFromPeople', () => {
  it('derives the band from people / capacity_reference', () => {
    expect(bandFromPeople(71, 180)).toBe('green'); // 0.394
    expect(bandFromPeople(72, 180)).toBe('amber'); // exactly 0.40
    expect(bandFromPeople(135, 180)).toBe('amber'); // exactly 0.75
    expect(bandFromPeople(136, 180)).toBe('red');
  });

  it('requires a positive capacity_reference', () => {
    expect(() => bandFromPeople(10, 0)).toThrow(RangeError);
    expect(() => bandFromPeople(10, -5)).toThrow(RangeError);
  });
});

describe('calmerBand', () => {
  it('steps down one band and stops at green', () => {
    expect(calmerBand('red')).toBe('amber');
    expect(calmerBand('amber')).toBe('green');
    expect(calmerBand('green')).toBe('green');
  });
});

import type { Band, ForecastBucket } from '@/schemas';

import { modalArrival, personalSuggestion } from '../suggestion';
import { bucketLabel } from '../time';

const b = (bucket: number, rel: number, band?: Band): ForecastBucket => ({
  bucket,
  time: bucketLabel(bucket),
  rel,
  band: band ?? (rel < 0.4 ? 'green' : rel > 0.75 ? 'red' : 'amber'),
});

describe('modalArrival', () => {
  it('picks the most frequent weekday, then its most frequent bucket', () => {
    const arrivals = [
      ...Array.from({ length: 8 }, () => ({ weekday: 1 as const, bucket: 74 })), // Tue 18:30
      { weekday: 1 as const, bucket: 75 },
      ...Array.from({ length: 4 }, () => ({ weekday: 3 as const, bucket: 73 })),
      ...Array.from({ length: 3 }, () => ({ weekday: 5 as const, bucket: 40 })),
    ];
    expect(modalArrival(arrivals)).toEqual({ weekday: 1, bucket: 74 });
  });

  it('breaks ties towards the earliest weekday and earliest bucket', () => {
    expect(
      modalArrival([
        { weekday: 4, bucket: 30 },
        { weekday: 2, bucket: 74 },
        { weekday: 2, bucket: 70 },
        { weekday: 4, bucket: 31 },
      ])
    ).toEqual({ weekday: 2, bucket: 70 });
  });

  it('returns null without history', () => {
    expect(modalArrival([])).toBeNull();
  });
});

describe('personalSuggestion (spec §4.7: nearest bucket at least 25% quieter)', () => {
  it('reproduces the spec example: "60% less people"', () => {
    // habit 18:30 at 94%, alternative 20:15 at 37.6% → 60% quieter
    const day = [b(74, 0.94, 'red'), b(81, 0.376, 'green')];
    expect(personalSuggestion(74, day)).toEqual({ habitBucket: 74, alternativeBucket: 81, lessPercent: 60 });
  });

  it('chooses the nearest qualifying bucket, before or after the habit', () => {
    const day = [b(74, 0.9, 'red'), b(72, 0.5), b(80, 0.3), b(60, 0.1)];
    expect(personalSuggestion(74, day)?.alternativeBucket).toBe(72);
  });

  it('on equal distance prefers the later bucket', () => {
    const day = [b(74, 0.9, 'red'), b(72, 0.5), b(76, 0.5)];
    expect(personalSuggestion(74, day)?.alternativeBucket).toBe(76);
  });

  it('requires at least 25% less: exactly 25% qualifies, less does not', () => {
    expect(personalSuggestion(74, [b(74, 1, 'red'), b(75, 0.75)])?.alternativeBucket).toBe(75);
    expect(personalSuggestion(74, [b(74, 1, 'red'), b(75, 0.76)])).toBeNull();
  });

  it('proposes nothing when the habitual slot is already green', () => {
    expect(personalSuggestion(40, [b(40, 0.3), b(50, 0.1)])).toBeNull();
  });

  it('proposes nothing when the habitual slot is not in the forecast (closed) or nothing is quieter', () => {
    expect(personalSuggestion(10, [b(74, 0.9, 'red'), b(75, 0.3)])).toBeNull();
    expect(personalSuggestion(74, [b(74, 0.9, 'red'), b(75, 0.9, 'red')])).toBeNull();
  });

  it('never suggests the habitual bucket itself', () => {
    expect(personalSuggestion(74, [b(74, 0.9, 'red')])).toBeNull();
  });
});

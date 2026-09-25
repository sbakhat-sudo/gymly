import type { Band, ForecastBucket } from '@/schemas';

import { nextGreenWindow } from '../green-window';
import { bucketLabel } from '../time';

/** Builds forecast buckets from `{ bucket: band }`; missing buckets model closed hours. */
function forecast(spec: Record<number, Band>): ForecastBucket[] {
  return Object.entries(spec).map(([bucket, band]) => ({
    bucket: Number(bucket),
    time: bucketLabel(Number(bucket)),
    band,
    rel: band === 'green' ? 0.2 : band === 'amber' ? 0.55 : 0.9,
  }));
}

/** 06:00 (bucket 24) … 22:45 (bucket 91): morning green, evening peak 18:00–20:00, then green from 20:15. */
function typicalDay(): ForecastBucket[] {
  const spec: Record<number, Band> = {};
  for (let b = 24; b <= 91; b++) {
    if (b < 30) spec[b] = 'amber'; // 06:00–07:30
    else if (b < 72) spec[b] = 'green'; // 07:30–18:00
    else if (b < 81) spec[b] = 'red'; // 18:00–20:15
    else spec[b] = 'green';
  }
  return forecast(spec);
}

const minutes = (h: number, m: number): number => h * 60 + m;

describe('nextGreenWindow', () => {
  it('finds the free window after the evening peak (the spec example, 20:15–…)', () => {
    const w = nextGreenWindow(typicalDay(), minutes(18, 30));
    expect(w).toEqual({ from: '20:15', to: '23:00', startsNow: false });
  });

  it('when the current bucket is already inside a green run, the window starts now', () => {
    const w = nextGreenWindow(typicalDay(), minutes(20, 37)); // bucket 82 = 20:30
    expect(w).toEqual({ from: '20:30', to: '23:00', startsNow: true });
  });

  it('ignores runs shorter than two buckets (a 15-minute blip is not a window)', () => {
    const w = nextGreenWindow(forecast({ 70: 'red', 71: 'green', 72: 'red', 80: 'green', 81: 'green', 82: 'green' }), minutes(17, 0));
    expect(w).toEqual({ from: '20:00', to: '20:45', startsNow: false });
  });

  it('a gap (missing bucket = closed) breaks a run', () => {
    const w = nextGreenWindow(forecast({ 81: 'green', 82: 'green', 84: 'green', 85: 'green' }), minutes(18, 0));
    expect(w).toEqual({ from: '20:15', to: '20:45', startsNow: false });
  });

  it('skips the current run when less than two buckets of it remain', () => {
    const w = nextGreenWindow(forecast({ 81: 'green', 82: 'green', 88: 'green', 89: 'green' }), minutes(20, 37)); // bucket 82
    expect(w).toEqual({ from: '22:00', to: '22:30', startsNow: false });
  });

  it('a window reaching closing time at midnight ends at 24:00', () => {
    expect(nextGreenWindow(forecast({ 92: 'green', 93: 'green', 94: 'green', 95: 'green' }), minutes(10, 0))).toEqual({
      from: '23:00',
      to: '24:00',
      startsNow: false,
    });
  });

  it('returns null when no green window is left today', () => {
    expect(nextGreenWindow(typicalDay(), minutes(23, 30))).toBeNull();
    expect(nextGreenWindow(forecast({ 72: 'red', 73: 'red' }), minutes(9, 0))).toBeNull();
    expect(nextGreenWindow([], minutes(9, 0))).toBeNull();
  });

  it('is independent of input order', () => {
    const shuffled = [...typicalDay()].reverse();
    expect(nextGreenWindow(shuffled, minutes(18, 30))).toEqual(nextGreenWindow(typicalDay(), minutes(18, 30)));
  });

  it('respects a custom minimum length', () => {
    const f = forecast({ 81: 'green', 82: 'green', 83: 'green', 84: 'green' });
    expect(nextGreenWindow(f, minutes(18, 0), 6)).toBeNull();
    expect(nextGreenWindow(f, minutes(18, 0), 4)).toMatchObject({ from: '20:15' });
  });
});

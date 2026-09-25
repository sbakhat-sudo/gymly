import type { Occupancy } from '@/schemas';

import { resolveHomeState, STALE_CACHE_MAX_AGE_S } from '../home-state';

const NOW = Date.parse('2026-09-21T16:30:00Z');
const ago = (s: number): string => new Date(NOW - s * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

const ok = (patch: Partial<Extract<Occupancy, { status: 'ok' }>> = {}): Occupancy => ({
  site_id: 'st_demo_centro',
  status: 'ok',
  band: 'red',
  confidence: 'high',
  accuracy_note: '±2%',
  observed_at: ago(40),
  zones: [{ zone_id: 'zn_pesi', name: 'Sala pesi', band: 'red' }],
  next_green_window: { from: '20:15', to: '21:30', source: 'forecast' },
  ...patch,
});

const resolve = (occupancy: Occupancy | null, source: 'network' | 'cache' = 'network') =>
  resolveHomeState({ occupancy, source, nowMs: NOW, stalenessLimitS: 300 });

describe('resolveHomeState (spec §4.5, §7)', () => {
  it('high confidence + fresh → live band without reservations', () => {
    const s = resolve(ok());
    expect(s).toMatchObject({ mode: 'live', band: 'red', approximate: false, ageS: 40, offline: false });
    if (s.mode === 'live') {
      expect(s.zones).toHaveLength(1);
      expect(s.accuracyNote).toBe('±2%');
      expect(s.nextGreenWindow?.from).toBe('20:15');
    }
  });

  it('medium confidence → live band flagged approximate ("~")', () => {
    expect(resolve(ok({ confidence: 'medium' }))).toMatchObject({ mode: 'live', approximate: true });
  });

  it('low confidence → band hidden, forecast mode (the band is not exposed at all)', () => {
    const s = resolve(ok({ confidence: 'low' }));
    expect(s.mode).toBe('forecast');
    expect(s).not.toHaveProperty('band');
  });

  it('status unavailable → "not available"', () => {
    const payload: Occupancy = { site_id: 'st_demo_centro', status: 'unavailable', confidence: 'unavailable', zones: [] };
    expect(resolve(payload)).toEqual({ mode: 'unavailable', reason: 'adapter' });
  });

  it('no valid payload (failed validation) → "not available", never a guess', () => {
    expect(resolve(null)).toEqual({ mode: 'unavailable', reason: 'invalid' });
  });

  it('an unparseable timestamp is treated as invalid data', () => {
    expect(resolve(ok({ observed_at: 'garbage' }))).toEqual({ mode: 'unavailable', reason: 'invalid' });
  });

  describe('staleness', () => {
    it('exactly at the site limit is still live; one second over is stale', () => {
      expect(resolve(ok({ observed_at: ago(300) })).mode).toBe('live');
      expect(resolve(ok({ observed_at: ago(301) })).mode).toBe('stale');
    });

    it('stale keeps the last band (to be shown dimmed and labelled) but drops zones and accuracy', () => {
      const s = resolve(ok({ observed_at: ago(600) }));
      expect(s).toEqual({ mode: 'stale', band: 'red', ageS: 600, offline: false });
    });

    it('beyond the hard limit the band is no longer shown at all', () => {
      expect(resolve(ok({ observed_at: ago(STALE_CACHE_MAX_AGE_S) })).mode).toBe('stale');
      expect(resolve(ok({ observed_at: ago(STALE_CACHE_MAX_AGE_S + 1) }))).toEqual({
        mode: 'unavailable',
        reason: 'too-old',
      });
    });

    it('a device clock behind the server (negative age) is clamped to 0, not shown as "in the future"', () => {
      expect(resolve(ok({ observed_at: ago(-90) }))).toMatchObject({ mode: 'live', ageS: 0 });
    });
  });

  describe('offline / cache', () => {
    it('a cached payload is flagged offline so the UI can label it explicitly', () => {
      expect(resolve(ok({ observed_at: ago(60) }), 'cache')).toMatchObject({ mode: 'live', offline: true });
      expect(resolve(ok({ observed_at: ago(900) }), 'cache')).toMatchObject({ mode: 'stale', offline: true });
    });

    it('a cached low-confidence payload still hides the band', () => {
      expect(resolve(ok({ confidence: 'low' }), 'cache').mode).toBe('forecast');
    });
  });
});

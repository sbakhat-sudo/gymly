import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Occupancy } from '@/schemas';

import { storage } from '../storage';

const PREFIX = 'gymly.v1.';

beforeEach(async () => {
  await AsyncStorage.clear();
  // Discarding a corrupted value logs a dev warning (by design); keep the test output clean.
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('typed storage', () => {
  it('round-trips valid values', async () => {
    await storage.set('siteId', 'st_demo_centro');
    await storage.set('lang', 'en');
    await storage.set('alertOptIn', true);
    await storage.set('alertWindow', { from: '17:00', to: '21:00' });
    await storage.set('sessionCount', 2);

    expect(await storage.get('siteId')).toBe('st_demo_centro');
    expect(await storage.get('lang')).toBe('en');
    expect(await storage.get('alertOptIn')).toBe(true);
    expect(await storage.get('alertWindow')).toEqual({ from: '17:00', to: '21:00' });
    expect(await storage.get('sessionCount')).toBe(2);
  });

  it('returns undefined for a key that was never written', async () => {
    expect(await storage.get('lang')).toBeUndefined();
  });

  it('refuses to write a value that violates its schema', async () => {
    // @ts-expect-error deliberately invalid language to exercise the runtime check
    await expect(storage.set('lang', 'fr')).rejects.toThrow();
    await expect(storage.set('siteId', 'not a site')).rejects.toThrow();
    await expect(storage.set('sessionCount', -1)).rejects.toThrow();
    await expect(storage.set('alertWindow', { from: '21:00', to: '17:00' })).rejects.toThrow();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('discards (and deletes) a corrupted or tampered value on read instead of crashing', async () => {
    await AsyncStorage.setItem(PREFIX + 'lang', JSON.stringify('klingon'));
    expect(await storage.get('lang')).toBeUndefined();
    expect(await AsyncStorage.getItem(PREFIX + 'lang')).toBeNull();

    await AsyncStorage.setItem(PREFIX + 'siteId', '{not json');
    expect(await storage.get('siteId')).toBeUndefined();
    expect(await AsyncStorage.getItem(PREFIX + 'siteId')).toBeNull();

    await AsyncStorage.setItem(PREFIX + 'sessionCount', JSON.stringify('3'));
    expect(await storage.get('sessionCount')).toBeUndefined();
  });

  it('stores under a namespaced prefix', async () => {
    await storage.set('demoMode', true);
    expect(await AsyncStorage.getAllKeys()).toEqual([PREFIX + 'demoMode']);
  });

  it('remove deletes one key only', async () => {
    await storage.set('lang', 'it');
    await storage.set('demoMode', true);
    await storage.remove('lang');
    expect(await storage.get('lang')).toBeUndefined();
    expect(await storage.get('demoMode')).toBe(true);
  });

  it('clearAll wipes everything ("Cancella i miei dati")', async () => {
    await storage.set('siteId', 'st_demo_centro');
    await storage.set('memberSiteId', 'st_demo_centro');
    await storage.set('alertOptIn', true);
    await AsyncStorage.setItem('someone.elses.key', '1');
    await storage.clearAll();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await storage.get('siteId')).toBeUndefined();
  });
});

describe('cached occupancy payload', () => {
  const payload: Occupancy = {
    site_id: 'st_demo_centro',
    status: 'ok',
    band: 'amber',
    confidence: 'high',
    accuracy_note: '±2%',
    observed_at: '2026-09-21T16:30:00Z',
    zones: [],
  };

  it('round-trips a valid payload', async () => {
    const value = { siteId: 'st_demo_centro', savedAt: '2026-09-21T16:30:05Z', payload };
    await storage.set('cachedOccupancy', value);
    expect(await storage.get('cachedOccupancy')).toEqual(value);
  });

  it('a cached entry with a malformed payload is discarded', async () => {
    await AsyncStorage.setItem(
      PREFIX + 'cachedOccupancy',
      JSON.stringify({ siteId: 'st_demo_centro', savedAt: '2026-09-21T16:30:05Z', payload: { ...payload, band: 'purple' } })
    );
    expect(await storage.get('cachedOccupancy')).toBeUndefined();
  });

  it('never persists a people count even if one slips into the object being saved', async () => {
    const polluted = { ...payload, people: 87 } as Occupancy;
    await storage.set('cachedOccupancy', { siteId: 'st_demo_centro', savedAt: '2026-09-21T16:30:05Z', payload: polluted });
    const raw = await AsyncStorage.getItem(PREFIX + 'cachedOccupancy');
    expect(raw).not.toContain('people');
    expect(raw).not.toContain('87');
  });
});

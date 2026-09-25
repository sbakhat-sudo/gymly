import type { Clock } from '@/lib/clock';
import { isApiError, type ApiErrorCode } from '@/lib/api/errors';

import { createMockApi } from '../mock-api';
import type { DemoControls } from '../demo';
import type { GymlyApi } from '../types';

/** Monday 2026-09-21, 18:30 in Rome (evening peak). */
const MONDAY_1830 = new Date('2026-09-21T16:30:00Z');
const DAY_MS = 86_400_000;

function fakeRandom(seed: number): (n: number) => Uint8Array {
  let a = seed;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      out[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
    }
    return out;
  };
}

function setup(initialLinkedSiteId: string | null = null): { api: GymlyApi; demo: DemoControls; setNow: (d: Date) => void } {
  let current = MONDAY_1830;
  const clock: Clock = { now: () => current };
  const { api, demo } = createMockApi({ clock, randomBytes: fakeRandom(99), initialLinkedSiteId });
  return { api, demo, setNow: (d) => (current = d) };
}

async function errorCode(p: Promise<unknown>): Promise<ApiErrorCode | 'no-error'> {
  try {
    await p;
    return 'no-error';
  } catch (e) {
    if (isApiError(e)) return e.code;
    throw e;
  }
}

const A = 'st_demo_centro';
const B = 'st_demo_riviera';
const C = 'st_demo_collina';

describe('sites', () => {
  it('lists three fictional gyms; only the WiFi one has no points capability', async () => {
    const { api } = setup();
    const sites = await api.getSites();
    expect(sites.map((s) => s.site_id)).toEqual([A, B, C]);
    expect(sites.map((s) => s.capabilities.points)).toEqual([true, true, false]);
    expect(sites.every((s) => s.timezone === 'Europe/Rome')).toBe(true);
  });

  it('contains nothing that looks like personal data', async () => {
    const { api } = setup();
    const json = JSON.stringify(await api.getSites());
    expect(json).not.toMatch(/@|\+39|https?:/);
  });
});

describe('occupancy', () => {
  it('Tier 0 with exits at the evening peak: red, high confidence, ±2%, zones present', async () => {
    const { api } = setup();
    const occ = await api.getOccupancy(A);
    expect(occ.status).toBe('ok');
    if (occ.status !== 'ok') return;
    expect(occ.band).toBe('red');
    expect(occ.confidence).toBe('high');
    expect(occ.accuracy_note).toBe('±2%');
    expect(occ.zones.map((z) => z.name)).toEqual(['Sala pesi', 'Cardio']);
    expect(occ.observed_at).toMatch(/^2026-09-21T16:29:\d\dZ$/);
    expect(occ.next_green_window?.source).toBe('forecast');
    expect(occ.next_green_window).toBeDefined();
    expect(occ.next_green_window?.from).toMatch(/^\d\d:\d\d$/);
    expect((occ.next_green_window?.from ?? '') > '18:30').toBe(true);
  });

  it('entry-only turnstile is capped at medium; WiFi is medium with its own accuracy', async () => {
    const { api } = setup();
    const b = await api.getOccupancy(B);
    const c = await api.getOccupancy(C);
    expect(b).toMatchObject({ status: 'ok', confidence: 'medium', accuracy_note: '±9%', zones: [] });
    expect(c).toMatchObject({ status: 'ok', confidence: 'medium', accuracy_note: '±12%', zones: [] });
  });

  it('never exposes a number of people, at any depth', async () => {
    const { api } = setup();
    for (const id of [A, B, C]) {
      const json = JSON.stringify(await api.getOccupancy(id));
      expect(json).not.toMatch(/people|count|persons|ratio|rel"/i);
      expect(json).not.toMatch(/:\s*\d+[,}]/); // no bare numeric field at all
    }
  });

  it('when the gym is closed the estimate is near-empty (the UI shows "closed", not a crowd)', async () => {
    const { api, setNow } = setup();
    setNow(new Date('2026-09-21T02:00:00Z')); // 04:00 Rome, closed
    const occ = await api.getOccupancy(A);
    expect(occ).toMatchObject({ status: 'ok', band: 'green' });
  });

  it('is deterministic for a given instant (same second → same answer)', async () => {
    const { api } = setup();
    expect(await api.getOccupancy(A)).toEqual(await api.getOccupancy(A));
  });

  describe('demo scenarios', () => {
    it('adapter down → status unavailable, no band at all', async () => {
      const { api, demo } = setup();
      demo.setScenario({ adapterDown: true });
      const occ = await api.getOccupancy(A);
      expect(occ.status).toBe('unavailable');
      expect(occ).not.toHaveProperty('band');
    });

    it('forced confidence and band', async () => {
      const { api, demo } = setup();
      demo.setScenario({ confidence: 'low', band: 'green' });
      expect(await api.getOccupancy(A)).toMatchObject({ status: 'ok', confidence: 'low', band: 'green' });
      demo.setScenario({ confidence: 'unavailable' });
      expect((await api.getOccupancy(A)).status).toBe('unavailable');
    });

    it('forced band drives zones too (weights room as busy as forced, cardio one step calmer)', async () => {
      const { api, demo } = setup();
      demo.setScenario({ band: 'red' });
      const occ = await api.getOccupancy(A);
      expect(occ.status === 'ok' && occ.zones.map((z) => z.band)).toEqual(['red', 'amber']);
    });

    it('zones can be forced on for a site without zones and off for one with', async () => {
      const { api, demo } = setup();
      demo.setScenario({ zones: 'on' });
      expect((await api.getOccupancy(B)).zones).toHaveLength(2);
      demo.setScenario({ zones: 'off' });
      expect((await api.getOccupancy(A)).zones).toHaveLength(0);
    });

    it('stale edge copy: still "ok", but observed_at is old', async () => {
      const { api, demo } = setup();
      demo.setScenario({ staleSeconds: 600 });
      const occ = await api.getOccupancy(A);
      expect(occ.status).toBe('ok');
      expect(occ.status === 'ok' && MONDAY_1830.getTime() - Date.parse(occ.observed_at)).toBe(600_000);
    });

    it('offline → network error on every call', async () => {
      const { api, demo } = setup();
      demo.setScenario({ offline: true });
      expect(await errorCode(api.getOccupancy(A))).toBe('network');
      expect(await errorCode(api.getSites())).toBe('network');
      expect(await errorCode(api.getForecast(A, 0))).toBe('network');
    });

    it('corrupt payload is rejected by validation, never returned', async () => {
      const { api, demo } = setup();
      demo.setScenario({ corruptPayload: true });
      expect(await errorCode(api.getOccupancy(A))).toBe('invalid_payload');
    });

    it('resetScenario restores defaults and notifies subscribers', async () => {
      const { demo } = setup();
      const listener = jest.fn();
      const off = demo.subscribe(listener);
      demo.setScenario({ offline: true, band: 'red' });
      demo.resetScenario();
      expect(demo.getScenario()).toMatchObject({ offline: false, band: 'auto', confidence: 'auto' });
      expect(listener).toHaveBeenCalledTimes(2);
      off();
      demo.setScenario({ offline: true });
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  it('unknown site → not_found', async () => {
    const { api } = setup();
    expect(await errorCode(api.getOccupancy('st_nope'))).toBe('not_found');
  });
});

describe('forecast', () => {
  it('Monday of site A: open buckets only (06:00–22:45), all valid, evening peak red', async () => {
    const { api } = setup();
    const { buckets } = await api.getForecast(A, 0);
    expect(buckets).toHaveLength(68);
    expect(buckets[0]?.time).toBe('06:00');
    expect(buckets.at(-1)?.time).toBe('22:45');
    const at1830 = buckets.find((b) => b.time === '18:30');
    expect(at1830?.band).toBe('red');
    expect(at1830?.rel).toBeGreaterThan(0.75);
    expect(buckets.find((b) => b.time === '22:00')?.band).toBe('green');
  });

  it('a closed day (site B on Sunday) returns no buckets', async () => {
    const { api } = setup();
    expect((await api.getForecast(B, 6)).buckets).toEqual([]);
  });

  it('rejects an invalid weekday', async () => {
    const { api } = setup();
    expect(await errorCode(api.getForecast(A, 7 as never))).toBe('bad_request');
    expect(await errorCode(api.getForecast(A, -1 as never))).toBe('bad_request');
  });
});

describe('member linking and capability check (spec §9.2)', () => {
  it('points endpoints require a linked card', async () => {
    const { api } = setup();
    expect(await api.getMe()).toEqual({ linked: false });
    expect(await errorCode(api.getPoints())).toBe('not_linked');
    expect(await errorCode(api.getRewards())).toBe('not_linked');
    expect(await errorCode(api.createRedemption('rw_guest', 'key-00000001'))).toBe('not_linked');
  });

  it('a site without named access control answers capability_unavailable and cannot be linked', async () => {
    const { api } = setup();
    expect(await errorCode(api.linkMember(C, 'DEMO1234'))).toBe('capability_unavailable');
    expect(await api.getMe()).toEqual({ linked: false });
  });

  it('validates and normalises the card code', async () => {
    const { api } = setup();
    expect(await errorCode(api.linkMember(A, 'ab'))).toBe('bad_request');
    expect(await errorCode(api.linkMember(A, '<script>'))).toBe('bad_request');
    expect(await api.linkMember(A, ' demo-1234 ')).toEqual({ linked: true, site_id: A });
  });

  it('restores a previous session\'s link', async () => {
    const { api } = setup(A);
    expect(await api.getMe()).toEqual({ linked: true, site_id: A });
    expect((await api.getPoints()).balance).toBe(330);
  });

  it('unlink and data deletion both forget the member', async () => {
    const { api } = setup(A);
    await api.unlinkMember();
    expect(await api.getMe()).toEqual({ linked: false });
    await api.linkMember(A, 'DEMO1234');
    await api.requestDataDeletion();
    expect(await api.getMe()).toEqual({ linked: false });
    expect(await errorCode(api.getPoints())).toBe('not_linked');
  });

  it('exposes the member\'s arrival history only when linked', async () => {
    const { api } = setup();
    expect(await errorCode(api.getArrivalHistory())).toBe('not_linked');
    await api.linkMember(A, 'DEMO1234');
    const { arrivals } = await api.getArrivalHistory();
    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals.length).toBeLessThanOrEqual(500);
  });
});

describe('points ledger (append-only) and rewards', () => {
  it('balance equals the sum of the ledger, most recent movement first', async () => {
    const { api } = setup(A);
    const points = await api.getPoints();
    expect(points.balance).toBe(330);
    expect(points.ledger.reduce((s, e) => s + e.delta, 0)).toBe(points.balance);
    const ids = points.ledger.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
    expect(points.rules.map((r) => r.id)[0]).toBe('pr_peak');
  });

  it('lists rewards with availability; an out-of-stock item shows 0', async () => {
    const { api } = setup(A);
    const { rewards } = await api.getRewards();
    expect(rewards.find((r) => r.id === 'rw_towel')?.stock).toBe(0);
    expect(rewards.find((r) => r.id === 'rw_discount')?.stock).toBeNull();
  });
});

describe('redemption', () => {
  it('creates a pending, random, single-use code that expires in 14 days, and holds the points', async () => {
    const { api } = setup(A);
    const r = await api.createRedemption('rw_guest', 'idem-key-0001');
    expect(r.status).toBe('pending');
    expect(r.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(r.qr).toBe(`GYMLY:R:${r.code}`);
    expect(Date.parse(r.expires_at) - Date.parse(r.created_at)).toBe(14 * DAY_MS);

    const points = await api.getPoints();
    expect(points.balance).toBe(330 - 120);
    expect(points.ledger[0]).toMatchObject({ delta: -120, reason: 'redemption', ref_id: r.id });
    expect(points.ledger.reduce((s, e) => s + e.delta, 0)).toBe(points.balance);
  });

  it('a retry with the same idempotency key returns the same redemption and spends nothing more', async () => {
    const { api } = setup(A);
    const first = await api.createRedemption('rw_guest', 'idem-key-0001');
    const retry = await api.createRedemption('rw_guest', 'idem-key-0001');
    expect(retry).toEqual(first);
    expect((await api.getPoints()).balance).toBe(210);
    expect((await api.getRedemptions()).redemptions).toHaveLength(1);
  });

  it('different requests get different codes', async () => {
    const { api } = setup(A);
    const a = await api.createRedemption('rw_guest', 'idem-key-0001');
    const b = await api.createRedemption('rw_guest', 'idem-key-0002');
    expect(a.code).not.toBe(b.code);
    expect(a.id).not.toBe(b.id);
  });

  it('refuses when points are insufficient, out of stock, unknown, or the key is malformed', async () => {
    const { api } = setup(A);
    await api.createRedemption('rw_pt', 'idem-key-0001'); // 300 → 30 left
    expect(await errorCode(api.createRedemption('rw_guest', 'idem-key-0002'))).toBe('insufficient_points');
    expect(await errorCode(api.createRedemption('rw_towel', 'idem-key-0003'))).toBe('out_of_stock');
    expect(await errorCode(api.createRedemption('rw_nope', 'idem-key-0004'))).toBe('not_found');
    expect(await errorCode(api.createRedemption('rw_guest', 'short'))).toBe('bad_request');
    expect((await api.getPoints()).balance).toBe(30);
  });

  it('pending redemptions reduce the availability shown, and validation consumes the stock', async () => {
    const { api, demo } = setup(A);
    const stock = async (): Promise<number | null | undefined> =>
      (await api.getRewards()).rewards.find((r) => r.id === 'rw_pt')?.stock;
    expect(await stock()).toBe(6);
    const r = await api.createRedemption('rw_pt', 'idem-key-0001');
    expect(await stock()).toBe(5);
    await demo.validateRedemption(r.id);
    expect((await api.getRedemptions()).redemptions[0]?.status).toBe('validated');
    expect(await stock()).toBe(5);
    // A validated code is spent for good: no refund, and it cannot be validated twice.
    await demo.validateRedemption(r.id);
    expect(await stock()).toBe(5);
  });

  it('a code left unused for 14 days expires and the points come back automatically', async () => {
    const { api, setNow } = setup(A);
    await api.createRedemption('rw_guest', 'idem-key-0001');
    expect((await api.getPoints()).balance).toBe(210);

    setNow(new Date(MONDAY_1830.getTime() + 13 * DAY_MS));
    expect((await api.getRedemptions()).redemptions[0]?.status).toBe('pending');

    setNow(new Date(MONDAY_1830.getTime() + 14 * DAY_MS + 1000));
    const points = await api.getPoints();
    expect(points.balance).toBe(330);
    expect(points.ledger[0]).toMatchObject({ delta: 120, reason: 'redemption_refund' });
    expect(points.ledger.reduce((s, e) => s + e.delta, 0)).toBe(points.balance);
    expect((await api.getRedemptions()).redemptions[0]?.status).toBe('expired');

    // Settling is idempotent: reading again does not refund twice.
    expect((await api.getPoints()).balance).toBe(330);
  });

  it('demo "expire now" behaves like the real expiry', async () => {
    const { api, demo } = setup(A);
    const r = await api.createRedemption('rw_guest', 'idem-key-0001');
    await demo.expireRedemption(r.id);
    expect((await api.getPoints()).balance).toBe(330);
    expect((await api.getRedemptions()).redemptions[0]?.status).toBe('expired');
  });

  it('the ledger always sums to the balance across a mixed sequence of operations', async () => {
    const { api, demo, setNow } = setup(A);
    const check = async (): Promise<void> => {
      const p = await api.getPoints();
      expect(p.ledger.reduce((s, e) => s + e.delta, 0)).toBe(p.balance);
      expect(p.balance).toBeGreaterThanOrEqual(0);
    };
    await check();
    const r1 = await api.createRedemption('rw_guest', 'idem-key-0001');
    await check();
    const r2 = await api.createRedemption('rw_guest', 'idem-key-0002');
    await check();
    await demo.validateRedemption(r1.id);
    await demo.expireRedemption(r2.id);
    await check();
    setNow(new Date(MONDAY_1830.getTime() + 30 * DAY_MS));
    await check();
  });
});

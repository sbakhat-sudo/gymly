import { z } from 'zod';

import { DEFAULT_ZONES, MOCK_SITES, type MockSiteDef, type MockZone } from '@/mocks/sites';
import { MOCK_LEDGER_SEED, MOCK_POINT_RULES, MOCK_REWARDS, mockArrivals } from '@/mocks/member';
import { expectedRatio, jitter } from '@/mocks/curve';
import {
  ArrivalHistorySchema,
  ForecastSchema,
  LinkCodeSchema,
  MeSchema,
  OccupancySchema,
  PointsSchema,
  RedemptionSchema,
  RedemptionsSchema,
  RewardsSchema,
  SitesSchema,
  WeekdaySchema,
  type Band,
  type Confidence,
  type LedgerEntry,
  type Me,
  type Redemption,
  type Weekday,
} from '@/schemas';

import type { Clock } from '../clock';
import { bandFromRatio, calmerBand } from '../domain/band';
import { computeConfidence } from '../domain/confidence';
import { nextGreenWindow } from '../domain/green-window';
import { REDEMPTION_EXPIRY_DAYS, generateRedemptionCode, redemptionQrPayload, type RandomBytes } from '../domain/redemption-code';
import { bucketLabel, isBucketOpen, localTime, openStatus } from '../domain/time';

import { createScenarioStore, type DemoControls, type ScenarioStore } from './demo';
import { ApiError } from './errors';
import type { GymlyApi } from './types';
import { parseResponse } from './validate';

export interface MockApiOptions {
  clock: Clock;
  /** CSPRNG for redemption codes (the app passes expo-crypto). */
  randomBytes: RandomBytes;
  scenario?: ScenarioStore;
  /** Restores the "linked" state of a previous session (persisted client-side as a demo stand-in). */
  initialLinkedSiteId?: string | null;
  /** Artificial network latency; 0 in tests. */
  latencyMs?: number;
}

interface RedemptionRecord {
  id: string;
  rewardId: string;
  rewardTitle: string;
  cost: number;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'validated' | 'expired';
}

const DAY_MS = 86_400_000;
const IdempotencyKeySchema = z.string().min(8).max(64);

/** RFC 3339 UTC without milliseconds, as in the spec's examples. */
const iso = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Demo backend: same contract as the real service, all data local and fictional. It behaves like
 * a server — it builds wire payloads and validates them through the very same Zod schemas an HTTP
 * client would use — so switching to a real `GymlyApi` needs no UI change.
 * "Server" state (ledger, redemptions) lives in memory only and resets on restart.
 */
export function createMockApi(options: MockApiOptions): { api: GymlyApi; demo: DemoControls } {
  const { clock, randomBytes, latencyMs = 0 } = options;
  const scenario = options.scenario ?? createScenarioStore();

  let linkedSiteId: string | null = options.initialLinkedSiteId ?? null;
  let ledger: LedgerEntry[] = [];
  let redemptions: RedemptionRecord[] = [];
  let idempotency = new Map<string, string>();
  let nextLedgerId = 1;
  /** Physical stock left per reward, decremented at validation (spec §9.3). */
  let stock = new Map<string, number | null>(MOCK_REWARDS.map((r) => [r.id, r.stock]));

  function resetMemberState(): void {
    ledger = [];
    redemptions = [];
    idempotency = new Map();
    nextLedgerId = 1;
    stock = new Map(MOCK_REWARDS.map((r) => [r.id, r.stock]));
  }

  function seedLedger(): void {
    const now = clock.now().getTime();
    ledger = MOCK_LEDGER_SEED.map(([daysAgo, delta]) => ({
      id: nextLedgerId++,
      delta,
      reason: 'offpeak_visit' as const,
      created_at: iso(new Date(now - daysAgo * DAY_MS)),
    }));
  }

  if (linkedSiteId) seedLedger();

  const gate = async (): Promise<void> => {
    if (latencyMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, latencyMs));
    if (scenario.get().offline) throw new ApiError('network');
  };

  const siteDef = (siteId: string): MockSiteDef => {
    const def = MOCK_SITES.find((s) => s.site_id === siteId);
    if (!def) throw new ApiError('not_found');
    return def;
  };

  // ─── Forecast & occupancy ─────────────────────────────────────────────────────

  function buildForecast(def: MockSiteDef, weekday: Weekday): { buckets: unknown[] } {
    const buckets: unknown[] = [];
    for (let bucket = 0; bucket < 96; bucket++) {
      if (!isBucketOpen(def.opening_hours, weekday, bucket)) continue;
      const rel = Math.round(Math.min(2, expectedRatio(weekday, bucket * 15 + 7) * def.loadFactor) * 100) / 100;
      buckets.push({ bucket, time: bucketLabel(bucket), band: bandFromRatio(rel), rel });
    }
    return { buckets };
  }

  function zoneDefsFor(def: MockSiteDef): MockZone[] {
    const mode = scenario.get().zones;
    if (mode === 'off') return [];
    if (mode === 'on') return def.zones.length > 0 ? def.zones : DEFAULT_ZONES;
    return def.zones;
  }

  function computeAccuracy(def: MockSiteDef): string | undefined {
    return def.mape === null ? undefined : `±${Math.max(1, Math.round(def.mape * 100))}%`;
  }

  async function getOccupancy(siteId: string) {
    await gate();
    const sc = scenario.get();
    const def = siteDef(siteId);
    const now = clock.now();
    const local = localTime(now, def.timezone);

    if (sc.corruptPayload) {
      // Deliberately malformed: must be rejected by validation, never rendered.
      return parseResponse(OccupancySchema, { site_id: def.site_id, status: 'ok', band: 'purple', confidence: 'certain' });
    }

    // What the estimator itself measured; independent from what an old cached body claims.
    const realStalenessS = 8 + Math.floor(jitter(`${siteId}|${Math.floor(now.getTime() / 30_000)}`) * 15);
    const observedAgeS = sc.staleSeconds ?? realStalenessS;

    let confidence: Confidence;
    if (sc.adapterDown) confidence = 'unavailable';
    else if (sc.confidence !== 'auto') confidence = sc.confidence;
    else {
      confidence = computeConfidence({
        adapterClass: def.adapterClass,
        calibrationAgeDays: def.calibrationAgeDays,
        mape: def.mape,
        stalenessS: realStalenessS,
        stalenessLimitS: def.staleness_limit_s,
        anomaly: false,
        capacitySource: def.capacitySource,
      });
    }

    if (confidence === 'unavailable') {
      return parseResponse(OccupancySchema, { site_id: def.site_id, status: 'unavailable' });
    }

    const open = openStatus(def.opening_hours, local.weekday, local.minutes).open;
    const noise = 1 + (jitter(`${siteId}|${local.dateKey}|${Math.floor(local.minutes / 5)}`) - 0.5) * 0.1;
    const ratio = open ? Math.max(0, expectedRatio(local.weekday, local.minutes) * def.loadFactor * noise) : 0.02;
    const band: Band = sc.band !== 'auto' ? sc.band : bandFromRatio(ratio);

    const zones = zoneDefsFor(def).map((z) => ({
      zone_id: z.zone_id,
      name: z.name,
      band: sc.band !== 'auto' ? (z.loadFactor >= 1 ? sc.band : calmerBand(sc.band)) : bandFromRatio(ratio * z.loadFactor),
    }));

    const forecast = parseResponse(ForecastSchema, buildForecast(def, local.weekday));
    const window = nextGreenWindow(forecast.buckets, local.minutes);

    return parseResponse(OccupancySchema, {
      site_id: def.site_id,
      status: 'ok',
      band,
      confidence,
      accuracy_note: computeAccuracy(def),
      observed_at: iso(new Date(now.getTime() - observedAgeS * 1000)),
      zones,
      next_green_window: window ? { from: window.from, to: window.to, source: 'forecast' } : undefined,
    });
  }

  // ─── Member state ─────────────────────────────────────────────────────────────

  function requireMember(): MockSiteDef {
    if (!linkedSiteId) throw new ApiError('not_linked');
    const def = siteDef(linkedSiteId);
    if (!def.points) throw new ApiError('capability_unavailable');
    return def;
  }

  const balance = (): number => ledger.reduce((sum, e) => sum + e.delta, 0);

  function appendLedger(delta: number, reason: LedgerEntry['reason'], refId?: string): void {
    ledger.push({
      id: nextLedgerId++,
      delta,
      reason,
      ...(refId ? { ref_id: refId } : {}),
      created_at: iso(clock.now()),
    });
  }

  /** Expired pending codes give their points back automatically (spec §9.3). */
  function settleExpiries(): void {
    const nowMs = clock.now().getTime();
    for (const r of redemptions) {
      if (r.status === 'pending' && r.expiresAt.getTime() <= nowMs) {
        r.status = 'expired';
        appendLedger(r.cost, 'redemption_refund', r.id);
      }
    }
  }

  const pendingFor = (rewardId: string): number =>
    redemptions.filter((r) => r.rewardId === rewardId && r.status === 'pending').length;

  const toWire = (r: RedemptionRecord): Redemption =>
    parseResponse(RedemptionSchema, {
      id: r.id,
      reward_id: r.rewardId,
      reward_title: r.rewardTitle,
      code: r.code,
      qr: redemptionQrPayload(r.code),
      status: r.status,
      created_at: iso(r.createdAt),
      expires_at: iso(r.expiresAt),
    });

  const api: GymlyApi = {
    async getSites() {
      await gate();
      const wire = {
        sites: MOCK_SITES.map((s) => ({
          site_id: s.site_id,
          name: s.name,
          address: s.address,
          timezone: s.timezone,
          staleness_limit_s: s.staleness_limit_s,
          opening_hours: s.opening_hours,
          capabilities: { points: s.points },
        })),
      };
      return parseResponse(SitesSchema, wire).sites;
    },

    getOccupancy,

    async getForecast(siteId, weekday) {
      await gate();
      const def = siteDef(siteId);
      if (!WeekdaySchema.safeParse(weekday).success) throw new ApiError('bad_request');
      return parseResponse(ForecastSchema, buildForecast(def, weekday));
    },

    async getMe() {
      await gate();
      return parseResponse(MeSchema, linkedSiteId ? { linked: true, site_id: linkedSiteId } : { linked: false });
    },

    async linkMember(siteId, code): Promise<Me> {
      await gate();
      const def = siteDef(siteId);
      const normalized = code.replace(/[\s-]/g, '').toUpperCase();
      if (!LinkCodeSchema.safeParse(normalized).success) throw new ApiError('bad_request');
      if (!def.points) throw new ApiError('capability_unavailable');
      if (linkedSiteId !== siteId) {
        resetMemberState();
        linkedSiteId = siteId;
        seedLedger();
      }
      return parseResponse(MeSchema, { linked: true, site_id: siteId });
    },

    async unlinkMember() {
      await gate();
      linkedSiteId = null;
      resetMemberState();
    },

    async requestDataDeletion() {
      await gate();
      linkedSiteId = null;
      resetMemberState();
    },

    async getPoints() {
      await gate();
      const def = requireMember();
      settleExpiries();
      return parseResponse(PointsSchema, {
        site_id: def.site_id,
        balance: balance(),
        ledger: [...ledger].reverse().slice(0, 200),
        rules: MOCK_POINT_RULES,
      });
    },

    async getRewards() {
      await gate();
      const def = requireMember();
      settleExpiries();
      return parseResponse(RewardsSchema, {
        site_id: def.site_id,
        rewards: MOCK_REWARDS.map((r) => {
          const left = stock.get(r.id) ?? null;
          return { ...r, stock: left === null ? null : Math.max(0, left - pendingFor(r.id)) };
        }),
      });
    },

    async getArrivalHistory() {
      await gate();
      requireMember();
      return parseResponse(ArrivalHistorySchema, { arrivals: mockArrivals() });
    },

    async createRedemption(rewardId, idempotencyKey) {
      await gate();
      requireMember();
      if (!IdempotencyKeySchema.safeParse(idempotencyKey).success) throw new ApiError('bad_request');

      // A retry with the same key returns the same redemption: no double spend.
      const existingId = idempotency.get(idempotencyKey);
      const existing = existingId ? redemptions.find((r) => r.id === existingId) : undefined;
      if (existing) return toWire(existing);

      settleExpiries();
      const reward = MOCK_REWARDS.find((r) => r.id === rewardId);
      if (!reward) throw new ApiError('not_found');
      const left = stock.get(reward.id) ?? null;
      if (left !== null && left - pendingFor(reward.id) <= 0) throw new ApiError('out_of_stock');
      if (balance() < reward.cost) throw new ApiError('insufficient_points');

      const taken = new Set(redemptions.map((r) => r.code));
      let code = generateRedemptionCode(randomBytes);
      while (taken.has(code)) code = generateRedemptionCode(randomBytes);

      const idBytes = randomBytes(6);
      const id = `rd_${Array.from(idBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const createdAt = clock.now();
      const record: RedemptionRecord = {
        id,
        rewardId: reward.id,
        rewardTitle: reward.title,
        cost: reward.cost,
        code,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + REDEMPTION_EXPIRY_DAYS * DAY_MS),
        status: 'pending',
      };
      redemptions.push(record);
      idempotency.set(idempotencyKey, id);
      // Points are held immediately so the same points cannot be spent twice; expiry refunds them.
      appendLedger(-reward.cost, 'redemption', id);
      return toWire(record);
    },

    async getRedemptions() {
      await gate();
      requireMember();
      settleExpiries();
      return parseResponse(RedemptionsSchema, { redemptions: [...redemptions].reverse().map(toWire) });
    },
  };

  const demo: DemoControls = {
    getScenario: scenario.get,
    setScenario: scenario.set,
    resetScenario: scenario.reset,
    subscribe: scenario.subscribe,
    async validateRedemption(id) {
      const r = redemptions.find((x) => x.id === id);
      if (!r || r.status !== 'pending') return;
      r.status = 'validated';
      const left = stock.get(r.rewardId) ?? null;
      if (left !== null) stock.set(r.rewardId, Math.max(0, left - 1));
      scenario.set({}); // notify subscribers so open screens refetch
    },
    async expireRedemption(id) {
      const r = redemptions.find((x) => x.id === id);
      if (!r || r.status !== 'pending') return;
      r.expiresAt = new Date(clock.now().getTime() - 1000);
      settleExpiries();
      scenario.set({}); // notify subscribers so open screens refetch
    },
  };

  return { api, demo };
}

import { ApiError } from '@/lib/api/errors';
import { parseResponse } from '@/lib/api/validate';

import {
  ForecastSchema,
  LinkCodeSchema,
  MeSchema,
  OccupancySchema,
  PointRuleSchema,
  RedemptionCodeSchema,
  SiteIdSchema,
  SiteSummarySchema,
} from '..';

/** The example response of spec §6.2, verbatim. */
const specOccupancy = {
  site_id: 'st_7f3a',
  status: 'ok',
  band: 'red',
  confidence: 'medium',
  accuracy_note: '±12%',
  observed_at: '2026-09-21T18:04:30Z',
  zones: [
    { zone_id: 'zn_pesi', name: 'Sala pesi', band: 'red' },
    { zone_id: 'zn_cardio', name: 'Cardio', band: 'green' },
  ],
  next_green_window: { from: '20:15', to: '21:30', source: 'forecast' },
};

describe('OccupancySchema (spec §6.2)', () => {
  it('accepts the spec example', () => {
    const parsed = OccupancySchema.parse(specOccupancy);
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') {
      expect(parsed.zones).toHaveLength(2);
      expect(parsed.next_green_window?.to).toBe('21:30');
    }
  });

  it('NEVER lets a people count through: unknown keys are stripped at the boundary', () => {
    const parsed = OccupancySchema.parse({ ...specOccupancy, people: 87, count: 87, zones: [{ zone_id: 'zn_pesi', name: 'Sala pesi', band: 'red', people: 40 }] });
    const json = JSON.stringify(parsed);
    expect(json).not.toMatch(/people|count|87|40/);
  });

  it('accepts the unavailable form and fills in its defaults', () => {
    expect(OccupancySchema.parse({ site_id: 'st_7f3a', status: 'unavailable' })).toEqual({
      site_id: 'st_7f3a',
      status: 'unavailable',
      confidence: 'unavailable',
      zones: [],
    });
  });

  it.each([
    ['unknown band', { ...specOccupancy, band: 'purple' }],
    ['unknown status', { ...specOccupancy, status: 'maybe' }],
    ['"unavailable" confidence with status ok', { ...specOccupancy, confidence: 'unavailable' }],
    ['missing observed_at', { ...specOccupancy, observed_at: undefined }],
    ['non-UTC timestamp', { ...specOccupancy, observed_at: '2026-09-21T18:04:30+02:00' }],
    ['non-ISO timestamp', { ...specOccupancy, observed_at: 'yesterday' }],
    ['accuracy without ± and %', { ...specOccupancy, accuracy_note: '12' }],
    ['malformed site id', { ...specOccupancy, site_id: 'ST 1; DROP' }],
    ['bad time in window', { ...specOccupancy, next_green_window: { from: '25:00', to: '21:30', source: 'forecast' } }],
    ['too many zones', { ...specOccupancy, zones: Array.from({ length: 13 }, (_, i) => ({ zone_id: `zn_${i}`, name: 'Z', band: 'green' })) }],
    ['not an object', 'red'],
    ['null', null],
  ])('rejects %s', (_label, payload) => {
    expect(OccupancySchema.safeParse(payload).success).toBe(false);
  });
});

describe('ForecastSchema (spec §6.2)', () => {
  const bucket = { bucket: 72, time: '18:00', band: 'red', rel: 0.94 };

  it('accepts the spec example bucket', () => {
    expect(ForecastSchema.safeParse({ buckets: [bucket] }).success).toBe(true);
  });

  it('accepts an empty day (closed)', () => {
    expect(ForecastSchema.safeParse({ buckets: [] }).success).toBe(true);
  });

  it.each([
    ['time not matching the bucket', { buckets: [{ ...bucket, time: '18:15' }] }],
    ['duplicate buckets', { buckets: [bucket, bucket] }],
    ['bucket out of range', { buckets: [{ ...bucket, bucket: 96, time: '24:00' }] }],
    ['rel above 2× capacity (absurd value, §4.6)', { buckets: [{ ...bucket, rel: 2.5 }] }],
    ['negative rel', { buckets: [{ ...bucket, rel: -0.1 }] }],
    ['unknown band', { buckets: [{ ...bucket, band: 'blue' }] }],
    ['more than 96 buckets', { buckets: Array.from({ length: 97 }, () => bucket) }],
  ])('rejects %s', (_label, payload) => {
    expect(ForecastSchema.safeParse(payload).success).toBe(false);
  });
});

describe('identifiers and small schemas', () => {
  it('site ids follow the spec shape', () => {
    expect(SiteIdSchema.safeParse('st_7f3a').success).toBe(true);
    expect(SiteIdSchema.safeParse('st_demo_centro').success).toBe(true);
    for (const bad of ['', 'ST-1', 'zn_pesi', 'st_', '../etc', 'st_' + 'a'.repeat(40)]) {
      expect(SiteIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('redemption codes exclude ambiguous characters', () => {
    expect(RedemptionCodeSchema.safeParse('ABC234').success).toBe(true);
    for (const bad of ['ABCDE0', 'ABCDEI', 'abc234', 'ABC23', 'ABC2345', 'ABC 34']) {
      expect(RedemptionCodeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('card-link codes: 6–12 upper-case alphanumerics', () => {
    expect(LinkCodeSchema.safeParse('DEMO1234').success).toBe(true);
    for (const bad of ['ab', 'demo1234', 'DEMO-1234', 'A'.repeat(13), '<script>']) {
      expect(LinkCodeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('"me" is a discriminated union: linked requires a site', () => {
    expect(MeSchema.safeParse({ linked: false }).success).toBe(true);
    expect(MeSchema.safeParse({ linked: true, site_id: 'st_7f3a' }).success).toBe(true);
    expect(MeSchema.safeParse({ linked: true }).success).toBe(false);
  });

  it('site summaries reject invalid IANA time zones (would crash Intl later)', () => {
    const site = {
      site_id: 'st_7f3a',
      name: 'Demo',
      address: null,
      timezone: 'Europe/Rome',
      staleness_limit_s: 300,
      opening_hours: [{ weekday: 0, opens_at: '06:00', closes_at: '23:00' }],
      capabilities: { points: true },
    };
    expect(SiteSummarySchema.safeParse(site).success).toBe(true);
    expect(SiteSummarySchema.safeParse({ ...site, timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(SiteSummarySchema.safeParse({ ...site, staleness_limit_s: 5 }).success).toBe(false);
  });

  it('point rules: weekday mask is 0..127, closing marker 24:00 allowed only as an end time', () => {
    const rule = { id: 'r', weekday_mask: 31, from_time: '21:00', to_time: '24:00', points: 50, daily_cap: 1 };
    expect(PointRuleSchema.safeParse(rule).success).toBe(true);
    expect(PointRuleSchema.safeParse({ ...rule, weekday_mask: 128 }).success).toBe(false);
    expect(PointRuleSchema.safeParse({ ...rule, from_time: '24:00' }).success).toBe(false);
    expect(PointRuleSchema.safeParse({ ...rule, points: -5 }).success).toBe(false);
  });
});

describe('parseResponse (API boundary)', () => {
  it('returns the parsed value when valid', () => {
    expect(parseResponse(MeSchema, { linked: false })).toEqual({ linked: false });
  });

  it('turns any violation into ApiError("invalid_payload") without echoing the received data', () => {
    let caught: unknown;
    try {
      parseResponse(OccupancySchema, { ...specOccupancy, band: 'SECRET-TOKEN-123' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('invalid_payload');
    expect((caught as ApiError).message).not.toContain('SECRET-TOKEN-123');
  });
});

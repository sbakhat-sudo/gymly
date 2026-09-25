import { z } from 'zod';

import { BandSchema, EndTimeOfDaySchema, Rfc3339UtcSchema, SiteIdSchema, TimeOfDaySchema, ZoneIdSchema } from './common';

/**
 * `GET /v1/public/sites/{site_id}/occupancy` (spec §6.2).
 *
 * Deliberately NO people count anywhere: object schemas strip unknown keys, so even if a
 * server ever sent one (`people`, `count`, …) it would be dropped at the boundary.
 */
export const ZoneBandSchema = z.object({
  zone_id: ZoneIdSchema,
  name: z.string().min(1).max(60),
  band: BandSchema,
});
export type ZoneBand = z.infer<typeof ZoneBandSchema>;

export const NextGreenWindowSchema = z.object({
  from: TimeOfDaySchema,
  to: EndTimeOfDaySchema,
  source: z.literal('forecast'),
});
export type NextGreenWindow = z.infer<typeof NextGreenWindowSchema>;

const OccupancyOkSchema = z.object({
  site_id: SiteIdSchema,
  status: z.literal('ok'),
  band: BandSchema,
  // `unavailable` is never sent together with status "ok".
  confidence: z.enum(['high', 'medium', 'low']),
  /** Declared accuracy of the site, e.g. "±12%". Optional: omitted when no verified figure exists. */
  accuracy_note: z
    .string()
    .regex(/^±\d{1,3}%$/)
    .optional(),
  observed_at: Rfc3339UtcSchema,
  zones: z.array(ZoneBandSchema).max(12).default([]),
  next_green_window: NextGreenWindowSchema.optional(),
});

const OccupancyUnavailableSchema = z.object({
  site_id: SiteIdSchema,
  status: z.literal('unavailable'),
  confidence: z.literal('unavailable').default('unavailable'),
  observed_at: Rfc3339UtcSchema.nullish(),
  zones: z.array(ZoneBandSchema).max(12).default([]),
});

export const OccupancySchema = z.discriminatedUnion('status', [OccupancyOkSchema, OccupancyUnavailableSchema]);
export type Occupancy = z.infer<typeof OccupancySchema>;
export type OccupancyOk = z.infer<typeof OccupancyOkSchema>;

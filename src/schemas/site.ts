import { z } from 'zod';

import { EndTimeOfDaySchema, SiteIdSchema, TimeOfDaySchema, WeekdaySchema } from './common';

/**
 * PROVISIONAL CONTRACT — the spec (§6.2) only lists `GET /v1/public/sites` without a response body.
 * Shape derived from the `sites` and `opening_hours` tables (§5).
 */
export const OpeningHoursSchema = z.object({
  weekday: WeekdaySchema,
  opens_at: TimeOfDaySchema,
  closes_at: EndTimeOfDaySchema,
});
export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

const TimeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'invalid IANA time zone');

export const SiteSummarySchema = z.object({
  site_id: SiteIdSchema,
  name: z.string().min(1).max(80),
  address: z.string().max(160).nullable(),
  timezone: TimeZoneSchema,
  staleness_limit_s: z.number().int().min(30).max(3600),
  opening_hours: z.array(OpeningHoursSchema).max(28),
  /** Points/nudge need named access control (Tier 0); see spec §9.2 (`409 capability_unavailable`). */
  capabilities: z.object({ points: z.boolean() }),
});
export type SiteSummary = z.infer<typeof SiteSummarySchema>;

export const SitesSchema = z.object({ sites: z.array(SiteSummarySchema).max(200) });
export type Sites = z.infer<typeof SitesSchema>;

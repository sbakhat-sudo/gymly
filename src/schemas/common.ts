import { z } from 'zod';

/** Occupancy band. Names follow the API/DB in the spec (§5, §6.2): green | amber | red. */
export const BandSchema = z.enum(['green', 'amber', 'red']);
export type Band = z.infer<typeof BandSchema>;

/** Confidence levels of an estimate (spec §4.5). */
export const ConfidenceSchema = z.enum(['high', 'medium', 'low', 'unavailable']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** RFC 3339 UTC timestamp, e.g. `2026-09-21T18:04:30Z` (spec §6.4). */
export const Rfc3339UtcSchema = z.iso.datetime();

/** 24h wall-clock time, `HH:MM`. */
export const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Exclusive end of a time range: like `TimeOfDaySchema` but `24:00` (= end of day / closing) is allowed. */
export const EndTimeOfDaySchema = z.union([TimeOfDaySchema, z.literal('24:00')]);

/**
 * Weekday index used everywhere in the app: 0 = Monday … 6 = Sunday.
 * The spec only says `weekday 0..6`; this is the app's (documented) convention.
 */
export const WeekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
export type Weekday = z.infer<typeof WeekdaySchema>;

/** Opaque ids look like `st_7f3a`, `zn_pesi` (spec §3, §6). */
export const SiteIdSchema = z.string().regex(/^st_[a-z0-9_]{1,32}$/);
export const ZoneIdSchema = z.string().regex(/^zn_[a-z0-9_]{1,32}$/);

/** A 15-minute bucket of the day, 0..95 (spec §5 `forecasts.bucket`). */
export const BucketSchema = z.number().int().min(0).max(95);

import { z } from 'zod';

import { BandSchema, BucketSchema, TimeOfDaySchema } from './common';

/**
 * `GET /v1/public/sites/{site_id}/forecast?weekday=N` (spec §6.2).
 * `rel` is the forecast relative to the site's capacity_reference (0.94 = 94%). It is a ratio used for
 * arithmetic (personal suggestion, colours) and is never shown to the member as a number of people.
 */
export const ForecastBucketSchema = z.object({
  bucket: BucketSchema,
  time: TimeOfDaySchema,
  band: BandSchema,
  rel: z.number().min(0).max(2),
});
export type ForecastBucket = z.infer<typeof ForecastBucketSchema>;

const pad = (n: number): string => String(n).padStart(2, '0');
const bucketTime = (bucket: number): string => `${pad(Math.floor(bucket / 4))}:${pad((bucket % 4) * 15)}`;

export const ForecastSchema = z
  .object({ buckets: z.array(ForecastBucketSchema).max(96) })
  .refine((f) => new Set(f.buckets.map((b) => b.bucket)).size === f.buckets.length, {
    message: 'duplicate buckets',
  })
  .refine((f) => f.buckets.every((b) => b.time === bucketTime(b.bucket)), {
    message: 'bucket/time mismatch',
  });
export type Forecast = z.infer<typeof ForecastSchema>;

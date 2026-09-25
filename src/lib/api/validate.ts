import type { z } from 'zod';

import { ApiError } from './errors';

/**
 * Validates an incoming payload against its schema. Every `GymlyApi` implementation (the mock today,
 * an HTTP client tomorrow) runs responses through this, so a malformed body can never reach the UI:
 * it surfaces as `ApiError('invalid_payload')` and the screens show "Dato non disponibile".
 *
 * The Zod issue list is intentionally dropped: it can quote received values.
 */
export function parseResponse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError('invalid_payload');
  return result.data;
}

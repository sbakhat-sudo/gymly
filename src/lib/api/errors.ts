/**
 * Machine-readable failure modes of the API layer. The UI maps `code` to a friendly, non-technical
 * message; `message` is for developers only and never shown or logged (it could embed data).
 */
export type ApiErrorCode =
  /** The device could not reach the service (or the demo "offline" switch is on). */
  | 'network'
  /** A response did not match its schema → the UI shows "Dato non disponibile". */
  | 'invalid_payload'
  /** 409 capability_unavailable — e.g. points on a site without named access control (spec §9.2). */
  | 'capability_unavailable'
  | 'not_linked'
  | 'not_found'
  | 'bad_request'
  | 'out_of_stock'
  | 'insufficient_points';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

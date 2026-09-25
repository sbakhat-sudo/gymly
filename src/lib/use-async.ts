import { useEffect, useState } from 'react';

import { ApiError, isApiError } from './api/errors';
import { logger } from './logger';

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  /** Runs the request again (keeps showing the previous data meanwhile). */
  reload: () => void;
}

/** Anything that is not an `ApiError` is treated as a connectivity problem; only its class name is logged. */
export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  logger.error('async.unexpected', e);
  return new ApiError('network');
}

interface Settled<T> {
  data: T | undefined;
  error: ApiError | null;
  /** Identifies the request this result belongs to, so a stale result is never shown as current. */
  request: number;
}

/**
 * Minimal data-fetching hook: runs `fn` when `deps` change (or on `reload()`), ignores results of
 * superseded or unmounted requests, and never throws into render.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], enabled = true): AsyncState<T> {
  const [request, setRequest] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ data: undefined, error: null, request: -1 });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fn().then(
      (data) => {
        if (alive) setSettled({ data, error: null, request });
      },
      (e: unknown) => {
        if (alive) setSettled((s) => ({ data: s.data, error: toApiError(e), request }));
      }
    );
    return () => {
      alive = false;
    };
    // `fn` is intentionally excluded: callers list the values it depends on in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, request, ...deps]);

  return {
    data: settled.data,
    error: settled.request === request ? settled.error : null,
    loading: enabled && settled.request !== request,
    reload: () => setRequest((r) => r + 1),
  };
}

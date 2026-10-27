import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, isApiError } from './api/errors';
import { logger } from './logger';

/**
 * How often every `useAsync` quietly re-reads its data while the app is on screen, so what other people do
 * (a Client checks in, a payment is recorded, a message arrives) shows up by itself — nobody has to reload the
 * page. Pass a different number — or `false` to switch it off — as the fourth argument for one call.
 *
 * Every second is as fast as a poll gets, and it costs one request per read per second per open screen: the
 * heavy, slow-moving reads (several weeks of hourly history) ask for `SLOW_REFRESH_MS` instead, and a read that
 * is still in flight is never started twice (see the interval below).
 */
export const AUTO_REFRESH_MS = 1_000;

/** For reads of long history that cannot change second by second. */
export const SLOW_REFRESH_MS = 10_000;

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

/** True while the app is in the foreground (on web: the tab is visible). Nothing refreshes in the background. */
function useForeground(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state !== 'background' && state !== 'inactive'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Two results that say the same thing, so a quiet refresh can keep the old object and skip a pointless re-render. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Minimal data-fetching hook: runs `fn` when `deps` change (or on `reload()`), ignores results of
 * superseded or unmounted requests, and never throws into render.
 *
 * It also keeps the data fresh on its own: every `refreshMs` while the app is visible it reads again, quietly —
 * no loading state, no error banner if one attempt fails (the last good data stays), and no re-render when
 * nothing changed — and it reads again the moment the app comes back to the foreground.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[], enabled = true, refreshMs: number | false = AUTO_REFRESH_MS): AsyncState<T> {
  const [request, setRequest] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ data: undefined, error: null, request: -1 });
  const foreground = useForeground();

  useEffect(() => {
    if (!enabled || !foreground) return;
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
  }, [enabled, foreground, request, ...deps]);

  useEffect(() => {
    if (!enabled || !foreground || refreshMs === false) return;
    let alive = true;
    // At one-second polling a slow answer must not pile requests up: while one is still out, the next tick waits.
    let inFlight = false;
    const tick = (): void => {
      if (inFlight) return;
      inFlight = true;
      fn().then(
        (data) => {
          inFlight = false;
          if (!alive) return;
          setSettled((s) => {
            // Only once this request's own first result is in, and only if something actually changed.
            if (s.request !== request) return s;
            if (sameData(s.data, data)) return s.error ? { ...s, error: null } : s;
            return { data, error: null, request };
          });
        },
        // A failed quiet refresh changes nothing: the screen keeps showing the last good data.
        () => {
          inFlight = false;
        }
      );
    };
    const id = setInterval(tick, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // Same reasoning as above: `fn` is replaced by the caller's `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, foreground, request, refreshMs, ...deps]);

  return {
    data: settled.data,
    error: settled.request === request ? settled.error : null,
    loading: enabled && settled.request !== request,
    reload: () => setRequest((r) => r + 1),
  };
}

import type { Forecast, Weekday } from '@/schemas';

import type { GymlyApi } from './api/types';
import { useApi } from './services-context';
import { useAsync, type AsyncState } from './use-async';

// Forecasts change once a night (spec: 24 h edge cache), so they are kept for the whole session.
const forecastCache = new Map<string, Promise<Forecast>>();

/** Drops session caches ("Cancella i miei dati"). */
export function clearSessionCaches(): void {
  forecastCache.clear();
}

function getForecastCached(api: GymlyApi, siteId: string, weekday: Weekday): Promise<Forecast> {
  const key = `${siteId}|${weekday}`;
  let entry = forecastCache.get(key);
  if (!entry) {
    entry = api.getForecast(siteId, weekday).catch((e: unknown) => {
      forecastCache.delete(key); // never cache a failure
      throw e;
    });
    forecastCache.set(key, entry);
  }
  return entry;
}

export function useForecast(siteId: string | undefined, weekday: Weekday, enabled = true): AsyncState<Forecast> {
  const api = useApi();
  return useAsync(() => getForecastCached(api, siteId ?? '', weekday), [api, siteId, weekday], enabled && siteId !== undefined);
}

/** The seven daily forecasts, Monday first. */
export function useWeekForecast(siteId: string | undefined): AsyncState<Forecast[]> {
  const api = useApi();
  return useAsync(
    () => Promise.all(([0, 1, 2, 3, 4, 5, 6] as const).map((d) => getForecastCached(api, siteId ?? '', d))),
    [api, siteId],
    siteId !== undefined
  );
}

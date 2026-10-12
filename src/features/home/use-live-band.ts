import { resolveHomeState } from '@/lib/domain/home-state';
import { localTime, openStatus } from '@/lib/domain/time';
import { useAppActive, useDemoRevision, useNow } from '@/lib/hooks';
import type { Band, SiteSummary } from '@/schemas';

import { useOccupancy } from './use-occupancy';

/**
 * The band a small piece of chrome (check-in button, gym-picker tile, check-in chip) may colour
 * itself with: the live band only when the Live tab itself would show it as live — open, fresh,
 * confident enough. Anything else is `null`, and callers fall back to a neutral colour: a green
 * button over a gym whose real state is unknown would read as "it's free" (constraint 6).
 */
export function useLiveBand(site: SiteSummary | undefined): Band | null {
  const appActive = useAppActive();
  const revision = useDemoRevision();
  const now = useNow(30_000, appActive);
  const occupancy = useOccupancy(site?.site_id, appActive, revision);
  if (!site) return null;

  const local = localTime(new Date(now), site.timezone);
  if (!openStatus(site.opening_hours, local.weekday, local.minutes).open) return null;
  const state = resolveHomeState({
    occupancy: occupancy.occupancy,
    source: occupancy.source,
    nowMs: now,
    stalenessLimitS: site.staleness_limit_s,
  });
  return state.mode === 'live' ? state.band : null;
}

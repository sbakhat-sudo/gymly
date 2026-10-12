import { createContext, useContext, type ReactNode } from 'react';

import { getSiteStatus } from '@/lib/gym-status';
import type { SiteSummary } from '@/schemas';

import { useAppState } from './app-state';
import { useAuth } from './auth/auth-context';
import { useApi } from './services-context';
import { useAsync, type AsyncState } from './use-async';

const SitesContext = createContext<AsyncState<SiteSummary[]> | null>(null);

/** Loads the (mock, guest-only) gym list once per launch and shares it with every tab. */
export function SitesProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const sites = useAsync(() => api.getSites(), [api]);
  return <SitesContext.Provider value={sites}>{children}</SitesContext.Provider>;
}

export type CurrentSite = AsyncState<SiteSummary[]> & {
  site: SiteSummary | undefined;
  /** First launch, or the stored gym no longer exists: the member must pick one. Never true for a real Client. */
  needsPicker: boolean;
};

async function fetchRealSiteSummary(siteId: string): Promise<SiteSummary> {
  const s = await getSiteStatus(siteId);
  return {
    site_id: siteId,
    name: s.name,
    address: null,
    timezone: s.timezone,
    staleness_limit_s: 120,
    opening_hours: s.openingHours,
    capabilities: { points: false },
  };
}

/**
 * A real, approved Client is scoped to their own gym (`auth.profile.siteId`) — never the mock
 * gym-picker. Everyone else (guest) keeps the existing behaviour: pick one of the mock sites,
 * persisted locally.
 */
export function useCurrentSite(): CurrentSite {
  const sitesCtx = useContext(SitesContext);
  const { siteId } = useAppState();
  const auth = useAuth();
  if (!sitesCtx) throw new Error('useCurrentSite must be used inside <SitesProvider>');

  const isRealClient = auth.status === 'active' && auth.profile.role === 'client';
  const realSiteId = isRealClient ? auth.profile.siteId : null;
  const real = useAsync(() => (realSiteId ? fetchRealSiteSummary(realSiteId) : Promise.resolve(undefined)), [realSiteId], realSiteId !== null);

  if (isRealClient) {
    return {
      data: real.data ? [real.data] : real.error ? [] : undefined,
      error: real.error,
      loading: real.loading,
      reload: real.reload,
      site: real.data,
      needsPicker: false,
    };
  }

  const site = sitesCtx.data?.find((s) => s.site_id === siteId);
  return { ...sitesCtx, site, needsPicker: siteId === null || (sitesCtx.data !== undefined && site === undefined) };
}

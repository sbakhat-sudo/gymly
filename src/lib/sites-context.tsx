import { createContext, useContext, type ReactNode } from 'react';

import type { SiteSummary } from '@/schemas';

import { useAppState } from './app-state';
import { useApi } from './services-context';
import { useAsync, type AsyncState } from './use-async';

const SitesContext = createContext<AsyncState<SiteSummary[]> | null>(null);

/** Loads the gym list once per launch and shares it with every tab. */
export function SitesProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const sites = useAsync(() => api.getSites(), [api]);
  return <SitesContext.Provider value={sites}>{children}</SitesContext.Provider>;
}

export type CurrentSite = AsyncState<SiteSummary[]> & {
  site: SiteSummary | undefined;
  /** First launch, or the stored gym no longer exists: the member must pick one. */
  needsPicker: boolean;
};

export function useCurrentSite(): CurrentSite {
  const sites = useContext(SitesContext);
  const { siteId } = useAppState();
  if (!sites) throw new Error('useCurrentSite must be used inside <SitesProvider>');
  const site = sites.data?.find((s) => s.site_id === siteId);
  return { ...sites, site, needsPicker: siteId === null || (sites.data !== undefined && site === undefined) };
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LANG, type Lang } from './i18n';
import { storage } from './storage';

/** Values read from storage once at launch, before the first frame (the splash screen stays up). */
export interface BootState {
  lang: Lang;
  siteId: string | null;
  memberSiteId: string | null;
  /** How many times the app has been opened, including this launch. */
  sessionCount: number;
  demoMode: boolean;
}

export const DEFAULT_BOOT_STATE: BootState = {
  lang: DEFAULT_LANG,
  siteId: null,
  memberSiteId: null,
  sessionCount: 1,
  demoMode: false,
};

export async function loadBootState(): Promise<BootState> {
  const [lang, siteId, memberSiteId, count, demoMode] = await Promise.all([
    storage.get('lang'),
    storage.get('siteId'),
    storage.get('memberSiteId'),
    storage.get('sessionCount'),
    storage.get('demoMode'),
  ]);
  const sessionCount = (count ?? 0) + 1;
  await storage.set('sessionCount', sessionCount);
  return {
    lang: lang ?? DEFAULT_LANG,
    siteId: siteId ?? null,
    memberSiteId: memberSiteId ?? null,
    sessionCount,
    demoMode: demoMode ?? false,
  };
}

interface AppState extends BootState {
  setLang(lang: Lang): void;
  setSiteId(siteId: string): void;
  setMemberSiteId(siteId: string | null): void;
  setDemoMode(on: boolean): void;
  /** Demo panel only: pretend the app has been opened `count` times (unlocks the alerts opt-in). */
  setSessionCount(count: number): void;
  /** After "Cancella i miei dati": back to the first-launch state (storage is wiped by the caller). */
  resetToInitial(): void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ initial, children }: { initial: BootState; children: ReactNode }) {
  const [state, setState] = useState<BootState>(initial);

  const setLang = useCallback((lang: Lang) => {
    setState((s) => ({ ...s, lang }));
    void storage.set('lang', lang);
  }, []);
  const setSiteId = useCallback((siteId: string) => {
    setState((s) => ({ ...s, siteId }));
    void storage.set('siteId', siteId);
  }, []);
  const setMemberSiteId = useCallback((siteId: string | null) => {
    setState((s) => ({ ...s, memberSiteId: siteId }));
    if (siteId) void storage.set('memberSiteId', siteId);
    else void storage.remove('memberSiteId');
  }, []);
  const setDemoMode = useCallback((on: boolean) => {
    setState((s) => ({ ...s, demoMode: on }));
    void storage.set('demoMode', on);
  }, []);
  const setSessionCount = useCallback((count: number) => {
    setState((s) => ({ ...s, sessionCount: count }));
    void storage.set('sessionCount', count);
  }, []);
  const resetToInitial = useCallback(() => {
    setState({ ...DEFAULT_BOOT_STATE, sessionCount: 0 });
  }, []);

  const value = useMemo<AppState>(
    () => ({ ...state, setLang, setSiteId, setMemberSiteId, setDemoMode, setSessionCount, resetToInitial }),
    [state, setLang, setSiteId, setMemberSiteId, setDemoMode, setSessionCount, resetToInitial]
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_LANG, type Lang } from './i18n';
import { storage } from './storage';

export type ThemePref = 'auto' | 'light' | 'dark';

/** Values read from storage once at launch, before the first frame (the splash screen stays up). */
export interface BootState {
  lang: Lang;
  siteId: string | null;
  memberSiteId: string | null;
  /** How many times the app has been opened, including this launch. */
  sessionCount: number;
  themePref: ThemePref;
  /** Using the member app without an account (Benvenuto → "Guarda l'affluenza senza account"). */
  guest: boolean;
}

export const DEFAULT_BOOT_STATE: BootState = {
  lang: DEFAULT_LANG,
  siteId: null,
  memberSiteId: null,
  sessionCount: 1,
  themePref: 'auto',
  guest: false,
};

export async function loadBootState(): Promise<BootState> {
  const [lang, siteId, memberSiteId, count, themePref, guest] = await Promise.all([
    storage.get('lang'),
    storage.get('siteId'),
    storage.get('memberSiteId'),
    storage.get('sessionCount'),
    storage.get('themePref'),
    storage.get('guest'),
  ]);
  const sessionCount = (count ?? 0) + 1;
  await storage.set('sessionCount', sessionCount);
  // Dev/Expo Go only: never resume a guest session left over from a previous test run (paired
  // with the same reset for the Supabase session in auth-context.tsx) — every launch lands on the
  // landing page instead of silently re-entering guest mode.
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev && guest) void storage.remove('guest');
  return {
    lang: lang ?? DEFAULT_LANG,
    siteId: siteId ?? null,
    memberSiteId: memberSiteId ?? null,
    sessionCount,
    themePref: themePref ?? 'auto',
    guest: isDev ? false : (guest ?? false),
  };
}

interface AppState extends BootState {
  setLang(lang: Lang): void;
  setSiteId(siteId: string): void;
  setMemberSiteId(siteId: string | null): void;
  setThemePref(pref: ThemePref): void;
  setGuest(on: boolean): void;
  /** After "Cancella i miei dati": back to the first-launch state (storage is wiped by the caller). */
  resetToInitial(): void;
  /** "Prova la demo" on Benvenuto (web only): same mock-data client app as `guest`, but also lifts
   * the native-only gate for the Client role — a marketing preview, not a real account. Deliberately
   * NOT persisted (unlike `guest`): it's a one-visit thing, never something to silently resume. */
  demo: boolean;
  setDemo(on: boolean): void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ initial, children }: { initial: BootState; children: ReactNode }) {
  const [state, setState] = useState<BootState>(initial);
  const [demo, setDemo] = useState(false);

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
  const setThemePref = useCallback((pref: ThemePref) => {
    setState((s) => ({ ...s, themePref: pref }));
    void storage.set('themePref', pref);
  }, []);
  const setGuest = useCallback((on: boolean) => {
    setState((s) => ({ ...s, guest: on }));
    if (on) void storage.set('guest', true);
    else void storage.remove('guest');
  }, []);
  const resetToInitial = useCallback(() => {
    setState({ ...DEFAULT_BOOT_STATE, sessionCount: 0 });
  }, []);

  const value = useMemo<AppState>(
    () => ({ ...state, setLang, setSiteId, setMemberSiteId, setThemePref, setGuest, resetToInitial, demo, setDemo }),
    [state, setLang, setSiteId, setMemberSiteId, setThemePref, setGuest, resetToInitial, demo]
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}

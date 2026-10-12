import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { checkPermissions, type PermissionsState } from '@/hooks/usePermissions';

interface PermissionsValue {
  /** null while the first check hasn't resolved yet. */
  state: PermissionsState | null;
  allGranted: boolean;
  /** Re-runs checkPermissions() — called on foreground return and after the member responds to a request. */
  recheck: () => void;
}

const PermissionsContext = createContext<PermissionsValue | null>(null);

/**
 * Shared between the root layout's routing gate and the `permissions` screen itself (a separate
 * route, so it can't receive this as a prop) — same Provider pattern as `AuthProvider`/
 * `AppStateProvider`. Only active while `enabled` (a real, approved Client on native): permissions
 * are meaningless for a guest, a staff account, or on web.
 */
export function PermissionsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<PermissionsState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let alive = true;
    void checkPermissions().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [enabled, tick]);

  const recheck = useCallback(() => setTick((t) => t + 1), []);
  const allGranted =
    state !== null && state.notifications === 'granted' && state.locationForeground === 'granted' && state.locationBackground === 'granted';

  return <PermissionsContext.Provider value={{ state, allGranted, recheck }}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsState(): PermissionsValue {
  const value = useContext(PermissionsContext);
  if (!value) throw new Error('usePermissionsState must be used inside <PermissionsProvider>');
  return value;
}

import { createContext, useContext, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { useCurrentSite } from '@/lib/sites-context';

import { useCheckin, type UseCheckinResult } from './use-checkin';
import { useRealCheckin } from './use-real-checkin';

const CheckinContext = createContext<UseCheckinResult | null>(null);

/**
 * Mounts the check-in hook exactly ONCE, above every tab screen, so the floating tab bar's central
 * button (band colour, timer) and the Check-in screen itself always agree — two independent calls
 * for the same gym would double-schedule notifications and double-run the time-derived auto
 * check-out effect. A real, approved Client gets the real-backend hook (`useRealCheckin`); a guest
 * gets the existing mock-backed one — both hooks are always called (Rules of Hooks), each a no-op
 * while it isn't the active one.
 */
export function CheckinProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const current = useCurrentSite();
  const isRealClient = auth.status === 'active' && auth.profile.role === 'client';

  const mockValue = useCheckin(!isRealClient && current.site ? { site_id: current.site.site_id, name: current.site.name } : null);
  const realValue = useRealCheckin(isRealClient && current.site ? { site_id: current.site.site_id } : null);

  const value = isRealClient ? realValue : mockValue;
  return <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>;
}

export function useCheckinContext(): UseCheckinResult {
  const value = useContext(CheckinContext);
  if (!value) throw new Error('useCheckinContext must be used inside <CheckinProvider>');
  return value;
}

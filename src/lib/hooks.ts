import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useClock, useDemoControls } from './services-context';

/**
 * Only 'background' and 'inactive' (iOS transitions) mean "not in the foreground". Anything else counts as
 * active — including the `unknown`/undefined value React Native reports for a moment at cold start,
 * which must NOT block the first load (nothing would ever be fetched until the app was backgrounded and reopened).
 */
function isForeground(state: string | null | undefined): boolean {
  return state !== 'background' && state !== 'inactive';
}

/** True while the app is in the foreground (nothing may poll or refresh in the background). */
export function useAppActive(): boolean {
  const [active, setActive] = useState(isForeground(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(isForeground(state)));
    return () => sub.remove();
  }, []);
  return active;
}

/** Current time in ms from the app clock, refreshed every `intervalMs` while `enabled` (used for live "x seconds ago"). */
export function useNow(intervalMs: number, enabled = true): number {
  const clock = useClock();
  const [now, setNow] = useState(() => clock.now().getTime());
  useEffect(() => {
    if (!enabled) return;
    const tick = (): void => setNow(clock.now().getTime());
    const id = setInterval(tick, intervalMs);
    const off = clock.subscribe(tick);
    return () => {
      clearInterval(id);
      off();
    };
  }, [clock, intervalMs, enabled]);
  return now;
}

/** Increments whenever the Demo panel changes the scenario or the simulated time, so screens refetch. */
export function useDemoRevision(): number {
  const demo = useDemoControls();
  const clock = useClock();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const bump = (): void => setRevision((r) => r + 1);
    const offClock = clock.subscribe(bump);
    const offDemo = demo ? demo.subscribe(bump) : undefined;
    return () => {
      offClock();
      offDemo?.();
    };
  }, [demo, clock]);
  return revision;
}

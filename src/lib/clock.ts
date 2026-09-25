/** Injectable time source: the app and the mock never call `Date.now()` directly. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock whose reading can be shifted (Demo panel "simulated time"). Time keeps flowing. */
export interface AdjustableClock extends Clock {
  offsetMs(): number;
  setOffsetMs(ms: number): void;
  subscribe(listener: () => void): () => void;
}

export function createAdjustableClock(base: Clock = systemClock): AdjustableClock {
  let offset = 0;
  const listeners = new Set<() => void>();
  return {
    now: () => new Date(base.now().getTime() + offset),
    offsetMs: () => offset,
    setOffsetMs(ms) {
      offset = ms;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

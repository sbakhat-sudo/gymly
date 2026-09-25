import type { Band, Confidence } from '@/schemas';

/**
 * Knobs of the demo backend, driven by the Demo panel. They exist only to let a reviewer walk
 * through every state described in the spec; a real API implementation exposes no `DemoControls`.
 */
export interface MockScenario {
  /** Force the confidence level, or `auto` = computed from the site's adapter/calibration (§4.5). */
  confidence: 'auto' | Confidence;
  /** Force the live band, or `auto` = follows the typical daily curve at the (simulated) time. */
  band: 'auto' | Band;
  /**
   * When set, the payload's `observed_at` is this many seconds old and the mock still answers
   * `status: "ok"` — like a CDN edge serving an old body (stale-while-revalidate, spec §6.2).
   */
  staleSeconds: number | null;
  /** Requests fail as if the device had no connection → the app falls back to its cache. */
  offline: boolean;
  /** Adapter down → the server answers `status: "unavailable"` (forecast-only mode). */
  adapterDown: boolean;
  /** Respond with a malformed body to prove that validation never lets it through. */
  corruptPayload: boolean;
  /** Zones: `auto` = as configured for the site, `on`/`off` = force. */
  zones: 'auto' | 'on' | 'off';
}

export const DEFAULT_SCENARIO: MockScenario = {
  confidence: 'auto',
  band: 'auto',
  staleSeconds: null,
  offline: false,
  adapterDown: false,
  corruptPayload: false,
  zones: 'auto',
};

export interface DemoControls {
  getScenario(): MockScenario;
  setScenario(patch: Partial<MockScenario>): void;
  resetScenario(): void;
  subscribe(listener: () => void): () => void;
  /** Play the reception scanning the member's QR: pending → validated. */
  validateRedemption(id: string): Promise<void>;
  /** Fast-forward a pending redemption past its 14-day expiry: it expires and the points come back. */
  expireRedemption(id: string): Promise<void>;
}

export interface ScenarioStore {
  get(): MockScenario;
  set(patch: Partial<MockScenario>): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createScenarioStore(): ScenarioStore {
  let current: MockScenario = { ...DEFAULT_SCENARIO };
  const listeners = new Set<() => void>();
  const emit = (): void => listeners.forEach((l) => l());
  return {
    get: () => current,
    set(patch) {
      current = { ...current, ...patch };
      emit();
    },
    reset() {
      current = { ...DEFAULT_SCENARIO };
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

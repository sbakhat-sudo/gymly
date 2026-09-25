import * as Crypto from 'expo-crypto';

import { createAdjustableClock, type AdjustableClock } from './clock';
import { createMockApi } from './api/mock-api';
import type { DemoControls } from './api/demo';
import type { GymlyApi } from './api/types';

export interface Services {
  api: GymlyApi;
  /** Present only for the demo backend; a real API has nothing to control. */
  demo: DemoControls | null;
  clock: AdjustableClock;
}

/**
 * Composition root and THE place to change when the real backend exists: build an `HttpApi`
 * that implements `GymlyApi` here instead of the mock. Nothing else in the app imports mocks.
 */
export function createServices(options: { initialLinkedSiteId?: string | null } = {}): Services {
  const clock = createAdjustableClock();
  const { api, demo } = createMockApi({
    clock,
    randomBytes: (n) => Crypto.getRandomBytes(n),
    initialLinkedSiteId: options.initialLinkedSiteId ?? null,
    latencyMs: 120,
  });
  return { api, demo, clock };
}

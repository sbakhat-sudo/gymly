import { createContext, useContext, type ReactNode } from 'react';

import type { AdjustableClock } from './clock';
import type { DemoControls } from './api/demo';
import type { GymlyApi } from './api/types';
import type { Services } from './services';

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('Services not provided');
  return services;
}

/** The data layer. Screens depend on this interface only. */
export function useApi(): GymlyApi {
  return useServices().api;
}

export function useClock(): AdjustableClock {
  return useServices().clock;
}

/** `null` when the backend is not the demo one. */
export function useDemoControls(): DemoControls | null {
  return useServices().demo;
}

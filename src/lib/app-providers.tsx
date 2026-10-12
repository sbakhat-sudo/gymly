import { useState, type ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CheckinProvider } from '@/features/checkin/checkin-context';

import { AppStateProvider, useAppState, type BootState } from './app-state';
import { AuthProvider } from './auth/auth-context';
import { I18nProvider } from './i18n';
import type { Services } from './services';
import { ServicesProvider } from './services-context';
import { SitesProvider } from './sites-context';

/**
 * Every non-navigation provider a screen needs, in the exact order production uses (see
 * src/app/_layout.tsx, which renders this and nothing else before the navigator). Screen tests
 * (src/features/__tests__/screens.test.tsx) render this SAME component instead of rebuilding the
 * stack by hand: a provider added, removed or reordered here is exercised by both at once, so it
 * can never quietly drift out of sync between what tests cover and what the app actually renders.
 *
 * Notably includes `SafeAreaProvider`: every screen calls `useSafeAreaInsets()` (components/Screen.tsx),
 * which throws without it — caught by `ErrorBoundary` below, showing only the generic error screen,
 * identically on phone and web. That combination is the one real bug this file exists to prevent.
 */
export function AppProviders({
  initial,
  createAppServices,
  /**
   * Passed straight through to SafeAreaProvider. Production never sets it (the app waits for the
   * real native measurement, as normal). Tests set it to a fixed frame so a screen renders on its
   * very first pass instead of waiting for a native `onInsetsChange` event that the JS test
   * renderer never fires — without it, screens simply render nothing, forever.
   */
  initialSafeAreaMetrics,
  children,
}: {
  initial: BootState;
  /** Builds the services for this session. Called once (`useState` initializer). Tests inject a fixed instance. */
  createAppServices: () => Services;
  initialSafeAreaMetrics?: Metrics;
  children: ReactNode;
}) {
  return (
    <SafeAreaProvider initialMetrics={initialSafeAreaMetrics}>
      <AppStateProvider initial={initial}>
        <Localized createAppServices={createAppServices}>{children}</Localized>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

function Localized({ createAppServices, children }: { createAppServices: () => Services; children: ReactNode }) {
  const { lang } = useAppState();
  const [services] = useState(createAppServices);
  return (
    <I18nProvider lang={lang}>
      <ErrorBoundary>
        <AuthProvider>
          <ServicesProvider services={services}>
            <SitesProvider>
              <CheckinProvider>{children}</CheckinProvider>
            </SitesProvider>
          </ServicesProvider>
        </AuthProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

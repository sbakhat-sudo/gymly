import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppStateProvider, DEFAULT_BOOT_STATE, loadBootState, useAppState, type BootState } from '@/lib/app-state';
import { I18nProvider } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { createServices } from '@/lib/services';
import { ServicesProvider } from '@/lib/services-context';
import { SitesProvider } from '@/lib/sites-context';
import { useTheme } from '@/lib/theme';

// Keep the native splash up until preferences are read: the first frame is already the right one.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState | null>(null);

  useEffect(() => {
    let alive = true;
    loadBootState()
      .catch((e: unknown) => {
        logger.error('boot.failed', e);
        return DEFAULT_BOOT_STATE;
      })
      .then((state) => {
        if (alive) setBoot(state);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (boot) void SplashScreen.hideAsync();
  }, [boot]);

  if (!boot) return null;
  return (
    <AppStateProvider initial={boot}>
      <Providers />
    </AppStateProvider>
  );
}

function Providers() {
  const { lang, memberSiteId } = useAppState();
  // Built once per launch. The only place that decides which GymlyApi implementation is used.
  const [services] = useState(() => createServices({ initialLinkedSiteId: memberSiteId }));
  const theme = useTheme();

  const navigationTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        notification: theme.danger,
      },
    };
  }, [theme]);

  return (
    <I18nProvider lang={lang}>
      <ErrorBoundary>
        <ServicesProvider services={services}>
          <SitesProvider>
            <ThemeProvider value={navigationTheme}>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="demo" options={{ presentation: 'modal' }} />
                <Stack.Screen name="redemption/[id]" options={{ presentation: 'modal' }} />
              </Stack>
            </ThemeProvider>
          </SitesProvider>
        </ServicesProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

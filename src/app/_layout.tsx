import '@/tasks/geofenceTask';

import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';
import { Unbounded_600SemiBold, Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DemoBanner } from '@/components/DemoBanner';
import { getMySubscription } from '@/features/billing/billing-api';
import { PlanChoiceModal } from '@/features/billing/PlanChoiceModal';
import { stopGeofencing, syncGeofences } from '@/hooks/useSyncGeofences';
import { DEFAULT_BOOT_STATE, loadBootState, useAppState, type BootState } from '@/lib/app-state';
import { AppProviders } from '@/lib/app-providers';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { CompleteProfileGate } from '@/features/profile/CompleteProfileGate';
import { cancelPaymentWarning, clearNotificationsOfUser, schedulePaymentWarning } from '@/lib/notifications';
import { PermissionsProvider, usePermissionsState } from '@/lib/permissions-context';
import { createServices } from '@/lib/services';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

// Keep the native splash up until preferences (and the Aurora type faces) are read: the first frame is already the right one.
void SplashScreen.preventAutoHideAsync();

// RN Web renders every `TextInput` as a real DOM `<input>`/`<textarea>`, so a focused one inherits
// the browser's own default focus outline — a square-cornered ring that ignores whatever
// `borderRadius` the element was actually given, breaking every pill-shaped search bar the moment
// it's focused. Dropped entirely (not replaced with a themed ring — tried that, also unwanted): the
// field's own border/background already shows which one is focused. Injected here (not
// `app/+html.tsx`) because that file only runs for a static web export, never for the `npx expo
// start` dev server this is actually tested against.
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    input:focus, textarea:focus {
      outline: none;
      box-shadow: none;
    }
  `;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState | null>(null);
  // On a load error the custom families never register: `fontFamily.*` then silently falls back
  // to the OS default (Text does not crash on an unknown fontFamily) — degrades gracefully.
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_600SemiBold,
  });

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

  const bootReady = boot !== null && (fontsLoaded || Boolean(fontError));
  useEffect(() => {
    if (fontError) logger.error('boot.fonts_failed', fontError);
  }, [fontError]);

  if (!bootReady || !boot) return null;
  return (
    <AppProviders initial={boot} createAppServices={() => createServices({ initialLinkedSiteId: boot.memberSiteId })}>
      <Navigator />
    </AppProviders>
  );
}

/**
 * Owns `auth` and wraps the actual stack in `PermissionsProvider` — a separate component because a
 * Context's own Provider can't be read by the component that renders it, only by its descendants,
 * and the `permissions` screen (a separate route file) needs that same context too.
 */
function Navigator() {
  const auth = useAuth();
  const isNative = Platform.OS !== 'web';
  // Skipped in dev (Expo Go) so testing isn't interrupted by the permissions gate every launch —
  // a real build (__DEV__ false) always asks, since automatic check-in genuinely needs them.
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  const needsPermissionsCheck = !isDev && auth.status === 'active' && isNative && auth.profile.role === 'client';

  // Splash stays up until the session/profile lookup resolves too, so the first frame is
  // already the right role's screen instead of a flash of the wrong one.
  useEffect(() => {
    if (auth.status !== 'loading') void SplashScreen.hideAsync();
  }, [auth.status]);

  if (auth.status === 'loading') return null;

  return (
    <PermissionsProvider enabled={needsPermissionsCheck}>
      <NavigatorStack auth={auth} isNative={isNative} needsPermissionsCheck={needsPermissionsCheck} />
    </PermissionsProvider>
  );
}

function NavigatorStack({
  auth,
  isNative,
  needsPermissionsCheck,
}: {
  auth: ReturnType<typeof useAuth>;
  isNative: boolean;
  needsPermissionsCheck: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { lang, t } = useI18n();
  const { guest, demo } = useAppState();
  const { allGranted, recheck } = usePermissionsState();
  // Manager/Coach/Admin/Owner are all staff dashboards meant for a browser, never the phone app.
  const staffOnNative =
    (auth.status === 'active' && isNative && (auth.profile.role === 'coach' || auth.profile.role === 'manager')) ||
    (auth.status === 'admin' && isNative) ||
    (auth.status === 'owner' && isNative) ||
    // An Admin-approved Manager with no gym yet (noProfile, role already known) would otherwise
    // reach CreateGymScreen via complete-profile.tsx on a phone — and a still-pending Manager
    // would reach the same (auth) group. Coach's own pending state is intentionally left alone.
    (auth.status === 'noProfile' && isNative && auth.role === 'manager') ||
    (auth.status === 'pending' && isNative && auth.profile.role === 'manager');
  const needsPermissionsScreen = needsPermissionsCheck && !allGranted;
  // The Client role (and the guest preview) is the opposite of Manager/Coach: phone-only, checked
  // in-gym on Expo Go — never from a browser. `demo` ("Prova la demo" on Benvenuto) is the one
  // deliberate exception: a marketing preview of the Client app, allowed on web too.
  const clientEligible = (auth.status === 'active' && auth.profile.role === 'client' && !needsPermissionsScreen) || (auth.status !== 'active' && guest);
  const realClientNative = auth.status === 'active' && isNative && auth.profile.role === 'client';
  // The first-login popups (plan choice, then profile) wait for the permissions screen to be done: a native Modal
  // presented while the navigator is still swapping screens can be dropped, leaving nothing on screen but a flag
  // that says it is showing.
  const clientReady = realClientNative && !needsPermissionsScreen;

  // Billing: whether this real Client must see the mandatory plan-choice popup, and whether a local
  // "ti bloccheremo tra poco" warning needs (re)scheduling — both driven by one poll of the same RPC,
  // re-run on foreground-return below (the server's own cron job is what actually moves the status
  // along; this just notices the result next time the Client's device checks in).
  const subscription = useAsync(() => getMySubscription(), [], realClientNative);
  useEffect(() => {
    if (!realClientNative) return;
    const sub = subscription.data?.subscription;
    if (sub && sub.status === 'grace' && sub.graceEndDate) {
      void schedulePaymentWarning(sub.graceEndDate, lang);
    } else {
      void cancelPaymentWarning();
    }
  }, [realClientNative, subscription.data, lang]);

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

  // Geofences and permissions only matter for the phone app, and only need re-checking when the
  // member actually returns to the app (both can change while it was backgrounded, e.g. a trip
  // to the OS Settings screen to grant something that was denied).
  useEffect(() => {
    if (!isNative) return;
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = previous === 'background' || previous === 'inactive';
      const isNowForeground = next !== 'background' && next !== 'inactive';
      if (wasBackground && isNowForeground) {
        recheck();
        void syncGeofences();
        subscription.reload();
      }
      previous = next;
    });
    return () => sub.remove();
    // `subscription` itself (the whole useAsync result) changes identity every render, so listing it
    // here would re-subscribe the listener constantly; `subscription.reload` only ever does a stable
    // `setRequest(r => r + 1)` regardless of which render's closure called it, so a "stale" reference
    // is harmless to call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, recheck]);

  // Also sync at login/startup itself, not just on the foreground-return path above: a cold start
  // straight into an already-permissioned Client account otherwise never registers a geofence until
  // the app is backgrounded and reopened once. Re-runs (harmlessly — `startGeofencingAsync` just
  // re-registers the same region) if `allGranted` flips, e.g. right after `PermissionsScreen` grants it.
  useEffect(() => {
    if (!realClientNative || !allGranted) return;
    void syncGeofences();
  }, [realClientNative, allGranted]);

  // Cold start from tapping the geofence "you've arrived" notification (or any local notification
  // carrying a `url`): read it once via the promise-based getter — NOT the `useLastNotificationResponse`
  // hook, which calls the native module's synchronous getter straight from a `useLayoutEffect` and
  // throws uncatchably in this project's test environment (`getLastNotificationResponseAsync` wraps
  // the exact same call, but any throw inside an `async` function always becomes a rejected promise
  // instead of an uncaught synchronous throw, so `.catch()` here can never miss it) — plus a live
  // listener for a tap that arrives while the app is already open, same
  // `addNotificationResponseReceivedListener` pattern `notifications.ts#addCheckinResponseListener` uses.
  // Who is signed in right now, for the notification taps below. A reminder carries the account it was made for: if
  // that is not the account signed in now, tapping it asks whether to switch to that account (sign out and sign in
  // again with its email) instead of opening the wrong account's screens.
  const [switchPrompt, setSwitchPrompt] = useState<{ email: string | null } | null>(null);
  const signedInUserId = 'session' in auth ? auth.session.user.id : null;
  const signedInUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    signedInUserIdRef.current = signedInUserId;
  }, [signedInUserId]);
  const authReady = auth.status !== 'loading';

  // Signing out clears the reminders of the account that left (and only those: another account still checked in on this
  // phone keeps its own) and stops watching the gym's area.
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (signedInUserId) {
      lastUserIdRef.current = signedInUserId;
      return;
    }
    if (auth.status !== 'signedOut' || !lastUserIdRef.current) return;
    void clearNotificationsOfUser(lastUserIdRef.current);
    void stopGeofencing();
    lastUserIdRef.current = null;
  }, [auth.status, signedInUserId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !authReady) return;
    let alive = true;

    function openFromResponse(response: Notifications.NotificationResponse | null | undefined): void {
      const data = response?.notification?.request?.content?.data;
      const owner = data?.userId;
      if (typeof owner === 'string' && owner !== signedInUserIdRef.current) {
        const email = data?.userEmail;
        setSwitchPrompt({ email: typeof email === 'string' ? email : null });
        return;
      }
      const url = data?.url;
      if (typeof url === 'string') router.push(url as Href);
    }

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (alive) openFromResponse(response);
      })
      .catch((e: unknown) => logger.error('notifications.last_response_failed', e));

    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [router, authReady]);

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Reflects the resolved theme (Settings → Aspetto), not just the OS scheme: 'auto' still tracks it live via useTheme(). */}
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      {clientReady ? <PlanChoiceModal visible={subscription.data?.needsPlanChoice === true} onDone={() => subscription.reload()} /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        {/* A guest (Benvenuto → "Guarda l'affluenza senza account") gets the member app without
            signing in; `demo` ("Prova la demo") additionally allows it on web. */}
        <Stack.Protected guard={clientEligible && (isNative || demo)}>
          <Stack.Screen name="(client)" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'active' && auth.profile.role === 'coach' && !isNative}>
          <Stack.Screen name="(coach)" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'active' && auth.profile.role === 'manager' && !isNative}>
          <Stack.Screen name="(manager)" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'admin' && !isNative}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'owner' && !isNative}>
          <Stack.Screen name="(owner)" />
        </Stack.Protected>
        <Stack.Protected guard={staffOnNative}>
          <Stack.Screen name="web-only" />
        </Stack.Protected>
        <Stack.Protected guard={clientEligible && !isNative && !demo}>
          <Stack.Screen name="mobile-only" />
        </Stack.Protected>
        {/* A real, approved Client on the phone must grant notifications + location before entering the app. */}
        <Stack.Protected guard={needsPermissionsScreen}>
          <Stack.Screen name="permissions" />
        </Stack.Protected>
        {/* !staffOnNative is load-bearing, not redundant: without it, a native noProfile/pending
            Manager would have BOTH this group and web-only simultaneously "allowed" (status is
            neither 'active' nor 'admin', so this guard alone stays true for them too), leaving
            which one actually renders up to Expo Router's own tie-breaking instead of this code. */}
        <Stack.Protected guard={auth.status !== 'active' && auth.status !== 'admin' && auth.status !== 'owner' && !guest && !staffOnNative}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Secondary Admin screens, reached by pushing from the Admin's own Impostazioni hub — kept
            outside the (admin) tab group the same way redemption/[id] sits outside (client)'s. */}
        <Stack.Protected guard={auth.status === 'admin' && !isNative}>
          <Stack.Screen name="pagamento" />
          {/* Declared here too, not left to auto-discovery: an undeclared route renders fine when pushed from
              Impostazioni but stays blank on a reload (F5) or a typed address. */}
          <Stack.Screen name="audit-gps" />
          <Stack.Screen name="azioni-admin" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'active' && auth.profile.role === 'manager' && !isNative}>
          <Stack.Screen name="capienza" />
        </Stack.Protected>
        <Stack.Screen name="redemption/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="feedback/[checkinId]" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Mandatory first-login profile for Owner/Manager/Coach — a popup over whatever they land on. */}
      <CompleteProfileGate hold={realClientNative && (needsPermissionsScreen || (subscription.data === undefined && subscription.error === null) || subscription.data?.needsPlanChoice === true)} />
      <ConfirmDialog
        visible={switchPrompt !== null}
        title={t('notification.otherAccount.title')}
        message={switchPrompt?.email ? t('notification.otherAccount.body', { email: switchPrompt.email }) : t('notification.otherAccount.bodyNoEmail')}
        confirmLabel={t('notification.otherAccount.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          const email = switchPrompt?.email;
          setSwitchPrompt(null);
          void auth.signOut().then(() => router.replace((email ? { pathname: '/(auth)/login', params: { email } } : '/(auth)/login') as Href));
        }}
        onCancel={() => setSwitchPrompt(null)}
      />
      {demo ? <DemoBanner /> : null}
    </ThemeProvider>
  );
}

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { usePermissionsState } from '@/lib/permissions-context';
import { spacing } from '@/lib/theme';

/**
 * Blocks a real, approved Client (native only — see the `permissions` guard in `_layout.tsx`) from
 * the app until notifications + location (foreground and background) are all granted: without them
 * the geofencing feature (`useSyncGeofences`) can never fire the "you've arrived" notification.
 * Requests run in this exact order (Notifications, then foreground location, then background —
 * iOS refuses a background request before a foreground grant exists). Once every permission is
 * granted, the root layout's guard itself routes away from this screen — there is no separate
 * "success" state to render here.
 */
export function PermissionsScreen() {
  const { t } = useI18n();
  const { allGranted, recheck } = usePermissionsState();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestAll(): Promise<void> {
    setBusy(true);
    await Notifications.requestPermissionsAsync();
    await Location.requestForegroundPermissionsAsync();
    await Location.requestBackgroundPermissionsAsync();
    setBusy(false);
    setRequested(true);
    recheck();
  }

  const showBlocked = requested && !allGranted;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <AppText variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t(showBlocked ? 'permissions.blocked.title' : 'permissions.title')}
        </AppText>
        <AppText muted style={{ textAlign: 'center', fontSize: 15, lineHeight: 21 }}>
          {t(showBlocked ? 'permissions.blocked.body' : 'permissions.body')}
        </AppText>

        {showBlocked ? (
          <Button label={t('permissions.blocked.openSettings')} onPress={() => void Linking.openSettings()} />
        ) : (
          <Button label={t('permissions.continue')} onPress={() => void requestAll()} disabled={busy} />
        )}
        {showBlocked ? <Button label={t('permissions.retry')} variant="secondary" onPress={recheck} /> : null}
      </View>
    </Screen>
  );
}

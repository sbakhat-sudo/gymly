import { Platform } from 'react-native';

import { translate, type Lang } from './i18n';
import { logger } from './logger';

/**
 * LOCAL notifications only (the sole kind that works in Expo Go; remote push needs a development
 * build and is out of scope). `expo-notifications` is imported lazily so it costs nothing at cold
 * start and is never loaded unless the member opts in.
 */
export type PermissionResult = 'granted' | 'denied' | 'unsupported';

const CHANNEL_ID = 'green-alert';
let handlerInstalled = false;

async function load(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null; // local notifications are not available on web
  try {
    const N = await import('expo-notifications');
    if (!handlerInstalled) {
      // Show the alert even while the app is open (it is fired from the foreground).
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerInstalled = true;
    }
    return N;
  } catch (e) {
    logger.error('notifications.load_failed', e);
    return null;
  }
}

/** Whether the OS permission is already granted (does not prompt). */
export async function hasAlertPermission(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    return (await N.getPermissionsAsync()).granted;
  } catch (e) {
    logger.error('notifications.permission_check_failed', e);
    return false;
  }
}

/**
 * Asks for the notification permission. Called ONLY from the member's explicit opt-in, and only
 * from the second session on, after a band has been seen (spec §7).
 */
export async function requestAlertPermission(): Promise<PermissionResult> {
  const N = await load();
  if (!N) return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Gym alerts',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    const current = await N.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';
    return (await N.requestPermissionsAsync()).granted ? 'granted' : 'denied';
  } catch (e) {
    logger.error('notifications.permission_failed', e);
    return 'unsupported';
  }
}

/** Fires the "your gym is quiet now" alert immediately. Returns false when it could not be shown. */
export async function sendGreenAlert(lang: Lang, siteName: string): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    if (!(await N.getPermissionsAsync()).granted) return false;
    await N.scheduleNotificationAsync({
      content: {
        title: translate(lang, 'alert.title'),
        body: translate(lang, 'alert.body', { name: siteName }),
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
    return true;
  } catch (e) {
    logger.error('notifications.send_failed', e);
    return false;
  }
}

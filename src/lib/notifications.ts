import { Platform } from 'react-native';

import { AUTO_CHECKOUT_GRACE_MS, STILL_HERE_AFTER_MS } from './domain/checkin';
import { translate, type Lang } from './i18n';
import { logger } from './logger';

/**
 * LOCAL notifications only (the sole kind that works in Expo Go; remote push needs a development
 * build and is out of scope). `expo-notifications` is imported lazily so it costs nothing at cold
 * start and is never loaded unless the member opts in.
 */
export type PermissionResult = 'granted' | 'denied' | 'unsupported';

const CHANNEL_ID = 'green-alert';
const CHECKIN_CHANNEL_ID = 'checkin';

/** Categories = the OS-level "actionable notification" buttons (spec: reply without opening the app). */
const STILL_HERE_CATEGORY = 'gymly-still-here';
const PROXIMITY_CATEGORY = 'gymly-proximity';
export const STILL_HERE_YES_ACTION = 'checkin-yes';
export const STILL_HERE_NO_ACTION = 'checkin-no';
export const PROXIMITY_CHECKIN_ACTION = 'checkin-now';

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

/**
 * Action button titles are baked into the OS category at registration time, so it is re-registered
 * (cheap, idempotent) with the member's current language right before each check-in notification is
 * scheduled, instead of once for the app's whole lifetime.
 */
async function ensureCheckinCategories(N: typeof import('expo-notifications'), lang: Lang): Promise<void> {
  await N.setNotificationCategoryAsync(STILL_HERE_CATEGORY, [
    { identifier: STILL_HERE_YES_ACTION, buttonTitle: translate(lang, 'checkin.stillHere.yes'), options: { opensAppToForeground: false } },
    { identifier: STILL_HERE_NO_ACTION, buttonTitle: translate(lang, 'checkin.stillHere.no'), options: { opensAppToForeground: false } },
  ]);
  await N.setNotificationCategoryAsync(PROXIMITY_CATEGORY, [
    { identifier: PROXIMITY_CHECKIN_ACTION, buttonTitle: translate(lang, 'checkin.button.in'), options: { opensAppToForeground: false } },
  ]);
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

/** Fires the "you're near the gym" reminder immediately — the Demo panel's stand-in for the real
 * background geofence trigger (`src/tasks/geofenceTask.ts`), which needs a real device location
 * change to fire on its own. Returns false when it could not be shown. */
export async function sendProximityReminder(lang: Lang, siteName: string): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    if (!(await N.getPermissionsAsync()).granted) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, { name: 'Check-in', importance: N.AndroidImportance.DEFAULT });
    }
    await ensureCheckinCategories(N, lang);
    await N.scheduleNotificationAsync({
      content: {
        title: translate(lang, 'checkin.notification.proximity.title'),
        body: translate(lang, 'checkin.notification.proximity.body', { name: siteName }),
        categoryIdentifier: PROXIMITY_CATEGORY,
      },
      trigger: Platform.OS === 'android' ? { channelId: CHECKIN_CHANNEL_ID } : null,
    });
    return true;
  } catch (e) {
    logger.error('notifications.send_failed', e);
    return false;
  }
}

/**
 * Schedules a single local reminder (Orari tab's "Avvisami" buttons — the best-moment hero card
 * and each free window), firing `secondsFromNow` from now. Returns false when it could not be
 * scheduled (permission not granted, or unsupported).
 */
export async function scheduleWindowReminder(lang: Lang, siteName: string, windowLabel: string, secondsFromNow: number): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    if (!(await N.getPermissionsAsync()).granted) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, { name: 'Gym alerts', importance: N.AndroidImportance.DEFAULT });
    }
    await N.scheduleNotificationAsync({
      content: {
        title: translate(lang, 'schedule.reminder.title'),
        body: translate(lang, 'schedule.reminder.body', { name: siteName, time: windowLabel }),
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    return true;
  } catch (e) {
    logger.error('notifications.window_reminder_failed', e);
    return false;
  }
}

// ─── Check-in reminders ─────────────────────────────────────────────────────────

export interface CheckinNotificationIds {
  stillHere: string | null;
  autoCheckout: string | null;
}

const NO_CHECKIN_IDS: CheckinNotificationIds = { stillHere: null, autoCheckout: null };

/**
 * Schedules the two check-in reminders (spec): an actionable "sei ancora qui?" 90 minutes from
 * check-in, and a plain heads-up 15 minutes after that. The actual check-out on a missed answer is
 * NOT performed by this notification firing (nothing runs reliably while the app is fully closed,
 * see AGENTS.md/CLAUDE.md on the Expo Go / no-background-work constraint) — it is instead derived
 * from timestamps, purely, by `domain/checkin.ts#resolveCheckinPhase`, the next time the app is open.
 * These two notifications only make sure the member is nudged even while the app is backgrounded.
 */
export async function scheduleCheckinReminders(lang: Lang, siteName: string): Promise<CheckinNotificationIds> {
  const N = await load();
  if (!N) return NO_CHECKIN_IDS;
  try {
    if (!(await N.getPermissionsAsync()).granted) return NO_CHECKIN_IDS;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, { name: 'Check-in', importance: N.AndroidImportance.DEFAULT });
    }
    await ensureCheckinCategories(N, lang);
    const channelId = Platform.OS === 'android' ? CHECKIN_CHANNEL_ID : undefined;
    const stillHere = await N.scheduleNotificationAsync({
      content: {
        title: translate(lang, 'checkin.notification.stillHere.title'),
        body: translate(lang, 'checkin.notification.stillHere.body', { name: siteName }),
        categoryIdentifier: STILL_HERE_CATEGORY,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: STILL_HERE_AFTER_MS / 1000, channelId },
    });
    const autoCheckout = await N.scheduleNotificationAsync({
      content: {
        title: translate(lang, 'checkin.notification.autoCheckout.title'),
        body: translate(lang, 'checkin.notification.autoCheckout.body'),
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: (STILL_HERE_AFTER_MS + AUTO_CHECKOUT_GRACE_MS) / 1000, channelId },
    });
    return { stillHere, autoCheckout };
  } catch (e) {
    logger.error('notifications.checkin_schedule_failed', e);
    return NO_CHECKIN_IDS;
  }
}

/** Cancels any pending check-in reminders: on manual check-out, or a "sì, ancora qui" confirmation (which reschedules fresh ones). */
export async function cancelCheckinReminders(ids: CheckinNotificationIds): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    if (ids.stillHere) await N.cancelScheduledNotificationAsync(ids.stillHere);
    if (ids.autoCheckout) await N.cancelScheduledNotificationAsync(ids.autoCheckout);
  } catch (e) {
    logger.error('notifications.checkin_cancel_failed', e);
  }
}

export type CheckinResponseHandlers = {
  onStillHereYes: () => void;
  onStillHereNo: () => void;
  onProximityCheckin: () => void;
};

/**
 * Wires the check-in action buttons to app logic. Registered once while the Check-in screen has
 * ever been visited this session (see `features/checkin/use-checkin.ts`); does nothing on web.
 */
export function addCheckinResponseListener(handlers: CheckinResponseHandlers): () => void {
  if (Platform.OS === 'web') return () => undefined;
  let alive = true;
  let sub: { remove: () => void } | null = null;
  void import('expo-notifications')
    .then((N) => {
      if (!alive) return;
      sub = N.addNotificationResponseReceivedListener((response) => {
        switch (response.actionIdentifier) {
          case STILL_HERE_YES_ACTION:
            handlers.onStillHereYes();
            break;
          case STILL_HERE_NO_ACTION:
            handlers.onStillHereNo();
            break;
          case PROXIMITY_CHECKIN_ACTION:
            handlers.onProximityCheckin();
            break;
          default:
            break;
        }
      });
    })
    .catch((e: unknown) => logger.error('notifications.listener_failed', e));
  return () => {
    alive = false;
    sub?.remove();
  };
}

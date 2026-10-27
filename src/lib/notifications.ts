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
        data: { url: '/(client)/checkin' },
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

/** How long to keep nagging after the 90-minute mark: until the 3-hour mark, when the Client is checked out
 * automatically (see `use-real-checkin.ts`). Capped well under iOS's ~64 pending-local-notification limit
 * together with anything else the app schedules. */
const REPEAT_INTERVAL_MS = 10 * 60_000;
const REPEAT_WINDOW_MS = 80 * 60_000;

/**
 * Real Client only: a bounded series of "sei ancora qui?" reminders, one at the 90-minute mark and
 * then every 10 minutes after that until the 3-hour mark, when the server checks the Client out by itself
 * (see CLAUDE.md and `use-real-checkin.ts`) — never a single one-off.
 * Scheduled as a flat list instead of one repeating trigger because Expo's `TIME_INTERVAL` repeat
 * starts firing immediately at its own interval, not at a delayed 90-minute mark — scheduling each
 * occurrence up front is the only way to get "nothing for 90 minutes, then every 10" out of local
 * notifications alone (no background work is ever assumed; see constraint 1).
 */
export async function scheduleRepeatingStillHereReminders(lang: Lang, siteName: string, userId: string, userEmail: string | null, sinceMs: number = Date.now()): Promise<string[]> {
  const N = await load();
  if (!N) return [];
  try {
    if (!(await N.getPermissionsAsync()).granted) return [];
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, { name: 'Check-in', importance: N.AndroidImportance.DEFAULT });
    }
    await ensureCheckinCategories(N, lang);
    const channelId = Platform.OS === 'android' ? CHECKIN_CHANNEL_ID : undefined;
    const ids: string[] = [];
    for (let elapsedMs = STILL_HERE_AFTER_MS; elapsedMs <= STILL_HERE_AFTER_MS + REPEAT_WINDOW_MS; elapsedMs += REPEAT_INTERVAL_MS) {
      // Counted from `sinceMs` (the check-in itself), so a series made again later keeps the same moments; the ones that
      // have already passed are skipped.
      const seconds = (sinceMs + elapsedMs - Date.now()) / 1000;
      if (seconds < 5) continue;
      const id = await N.scheduleNotificationAsync({
        content: {
          title: translate(lang, 'checkin.notification.stillHere.title'),
          body: translate(lang, 'checkin.notification.stillHere.body', { name: siteName }),
          categoryIdentifier: STILL_HERE_CATEGORY,
          // Whose reminder it is (and the email to sign in with): a button press only counts for the account that is signed
          // in right now, and a tap from another account offers to switch to this one.
          data: { url: '/(client)/checkin', userId, userEmail },
        },
        trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId },
      });
      ids.push(id);
    }
    return ids;
  } catch (e) {
    logger.error('notifications.repeating_checkin_schedule_failed', e);
    return [];
  }
}

/** Cancels every pending reminder from `scheduleRepeatingStillHereReminders`: on manual check-out, or
 * a "sì, ancora qui" confirmation (which reschedules a fresh series). */
export async function cancelRepeatingReminders(ids: readonly string[]): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    for (const id of ids) await N.cancelScheduledNotificationAsync(id);
  } catch (e) {
    logger.error('notifications.repeating_checkin_cancel_failed', e);
  }
}

/** The check-in reminders still waiting for this account (only this one's — another account on the same phone keeps its own). */
async function pendingStillHereFor(N: typeof import('expo-notifications'), userId: string): Promise<string[]> {
  const all = await N.getAllScheduledNotificationsAsync();
  return all.filter((n) => n.content.categoryIdentifier === STILL_HERE_CATEGORY && n.content.data?.userId === userId).map((n) => n.identifier);
}

/** Whether this account has check-in reminders waiting. */
export async function hasPendingStillHereReminders(userId: string): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    return (await pendingStillHereFor(N, userId)).length > 0;
  } catch (e) {
    logger.error('notifications.pending_lookup_failed', e);
    return false;
  }
}

/**
 * On sign-out: forgets the reminders of the account that just left — and only those. Another account that is checked in
 * on this same phone keeps its own reminders, so signing in and out to switch accounts never silences one that is still
 * inside the gym.
 */
export async function clearNotificationsOfUser(userId: string): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    for (const id of await pendingStillHereFor(N, userId)) await N.cancelScheduledNotificationAsync(id);
    const shown = await N.getPresentedNotificationsAsync();
    for (const n of shown) {
      if (n.request.content.data?.userId === userId) await N.dismissNotificationAsync(n.request.identifier);
    }
  } catch (e) {
    logger.error('notifications.clear_user_failed', e);
  }
}

const PAYMENT_WARNING_ID = 'gymly-payment-warning';

/**
 * A single local notification ~24h before `graceEndDate` (the subscription row's own, already-known
 * deadline) — same "relative seconds from a known future timestamp" technique as
 * `scheduleCheckinReminders`, never a server push (this project has none, see CLAUDE.md). Re-scheduled
 * on every foreground-return poll of `client_get_my_subscription()` while status stays 'grace';
 * explicitly cancels any previous one first (a fixed `identifier` alone isn't trusted to dedupe) so a
 * re-poll never stacks duplicates. A no-op once the deadline has already passed (e.g. the app was
 * opened again after the 24h mark, or the warning window is in the past) — the in-app "Devi pagare"
 * banner, not this notification, is this app's authoritative source once it's open.
 */
export async function schedulePaymentWarning(graceEndDate: string, lang: Lang): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(PAYMENT_WARNING_ID).catch(() => undefined);
    if (!(await N.getPermissionsAsync()).granted) return;
    const graceEndMs = new Date(`${graceEndDate}T00:00:00`).getTime();
    const secondsFromNow = (graceEndMs - 24 * 60 * 60_000 - Date.now()) / 1000;
    if (secondsFromNow <= 0) return;
    await N.scheduleNotificationAsync({
      identifier: PAYMENT_WARNING_ID,
      content: { title: translate(lang, 'billing.notification.title'), body: translate(lang, 'billing.notification.body') },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
    });
  } catch (e) {
    logger.error('notifications.payment_warning_schedule_failed', e);
  }
}

/** Cancels the payment warning: once the Client pays (reactivating the subscription) or the app
 * notices status is no longer 'grace'. */
export async function cancelPaymentWarning(): Promise<void> {
  const N = await load();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(PAYMENT_WARNING_ID);
  } catch (e) {
    logger.error('notifications.payment_warning_cancel_failed', e);
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
export function addCheckinResponseListener(handlers: CheckinResponseHandlers, currentUserId?: () => string | null): () => void {
  if (Platform.OS === 'web') return () => undefined;
  let alive = true;
  let sub: { remove: () => void } | null = null;
  void import('expo-notifications')
    .then((N) => {
      if (!alive) return;
      sub = N.addNotificationResponseReceivedListener((response) => {
        // A reminder left over from another account (signed out, or switched) must not act on this one.
        const owner = response.notification.request.content.data?.userId;
        if (typeof owner === 'string' && currentUserId && owner !== currentUserId()) return;
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

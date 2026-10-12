import Constants, { AppOwnership } from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage';

export const GYM_GEOFENCE_TASK = 'GYM_GEOFENCE';

/** Don't refire the "you're near the gym" notification for the same site more than once an hour —
 * entering/exiting/re-entering a geofence's radius while parked at the edge of it otherwise spams it. */
const NOTIFY_DEBOUNCE_MS = 60 * 60 * 1000;

async function shouldNotify(siteId: string): Promise<boolean> {
  const last = await storage.get('geofenceLastNotify');
  if (!last || last.siteId !== siteId) return true;
  return Date.now() - Date.parse(last.sentAt) >= NOTIFY_DEBOUNCE_MS;
}

/**
 * `Constants.appOwnership === 'expo'` is the one reliable way to tell "actually running inside the
 * Expo Go app" apart from a real development build — `Constants.executionEnvironment` reports
 * `StoreClient` for both, which isn't precise enough here. `appOwnership` is deprecated in favour
 * of `executionEnvironment`, but for this specific distinction it's still the correct signal:
 * background location + `expo-task-manager` genuinely doesn't work in Expo Go (no amount of JS can
 * fix that, it's a missing native module), but does work in a dev build, where `appOwnership` is
 * null. Exported so `useSyncGeofences` can skip `startGeofencingAsync` there too — calling it
 * without a defined task throws "Task not found", the crash this file works around.
 */
export const isExpoGo = Constants.appOwnership === AppOwnership.Expo;

/**
 * Defined at module scope, never inside a component — `TaskManager.defineTask` must run once at
 * app boot, before the task is ever registered by `useSyncGeofences`, or `startGeofencingAsync`
 * throws "Task not found". Imported as the very first line of `src/app/_layout.tsx` for that reason.
 *
 * Skipped on web (`expo-task-manager` has no web implementation) and in Expo Go (see `isExpoGo`
 * above) — still at module scope either way (not a component), which is what "never inside a
 * component" is actually guarding against (a task defined on every render, or missing entirely
 * until some screen mounts). The rest of the app works normally in Expo Go; only the "you've
 * arrived" background notification is unavailable there — a real Expo Go limitation, not a bug.
 */
if (Platform.OS !== 'web' && !isExpoGo) {
  TaskManager.defineTask(GYM_GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      logger.error('geofence.task_error', error);
      return;
    }
    const event = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion } | null;
    if (!event || event.eventType !== Location.GeofencingEventType.Enter) return;

    const siteId = event.region.identifier;
    if (!siteId || !(await shouldNotify(siteId))) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sei vicino alla palestra',
        body: 'Fai il check-in!',
        data: { url: '/(client)/checkin', siteId },
      },
      trigger: null,
    });
    await storage.set('geofenceLastNotify', { siteId, sentAt: new Date().toISOString() });
  });
}

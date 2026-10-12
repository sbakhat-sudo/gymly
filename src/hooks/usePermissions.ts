import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

export interface PermissionsState {
  notifications: Notifications.PermissionStatus;
  locationForeground: Location.PermissionStatus;
  locationBackground: Location.PermissionStatus;
}

const UNDETERMINED: PermissionsState = {
  notifications: Notifications.PermissionStatus.UNDETERMINED,
  locationForeground: Location.PermissionStatus.UNDETERMINED,
  locationBackground: Location.PermissionStatus.UNDETERMINED,
};

/**
 * Reads (never requests) the three permissions the geofencing feature needs, and mirrors whether
 * background location is actually granted onto the signed-in user's own `profiles.location_always`
 * — the column the RLS-scoped self-update grant already allows. Web has no location/notification
 * permission model, so it always reports 'undetermined' there.
 */
export async function checkPermissions(): Promise<PermissionsState> {
  if (Platform.OS === 'web') return UNDETERMINED;

  try {
    const [notif, fg, bg] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    const state: PermissionsState = {
      notifications: notif.status,
      locationForeground: fg.status,
      locationBackground: bg.status,
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ location_always: bg.status === Location.PermissionStatus.GRANTED })
        .eq('id', user.id);
      if (error) logger.error('permissions.location_always_update_failed', error);
    }

    return state;
  } catch (e) {
    logger.error('permissions.check_failed', e);
    return UNDETERMINED;
  }
}

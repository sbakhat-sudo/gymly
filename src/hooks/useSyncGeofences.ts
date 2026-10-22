import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

import { GYM_GEOFENCE_TASK, isExpoGo } from '@/tasks/geofenceTask';

/** iOS refuses more than 20 simultaneously monitored regions. */
const MAX_IOS_REGIONS = 20;

/**
 * This project has no "memberships" table: a client belongs to exactly one gym via
 * `profiles.site_id`, so there is at most one region to register today — written as a list (and
 * still capped at 20) so it keeps working unchanged if that ever becomes one-to-many.
 */
export async function syncGeofences(): Promise<void> {
  // In Expo Go, `GYM_GEOFENCE_TASK` was never defined (see geofenceTask.ts) — calling
  // start/stopGeofencingAsync there throws "Task not found" instead of quietly doing nothing.
  if (Platform.OS === 'web' || isExpoGo) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, status, site_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;

    const isActiveClient = profile?.role === 'client' && profile.status === 'active' && Boolean(profile.site_id);
    if (!isActiveClient || !profile?.site_id) {
      await Location.stopGeofencingAsync(GYM_GEOFENCE_TASK).catch(() => undefined);
      return;
    }

    const { data: geo, error: geoErr } = await supabase.rpc('get_site_geofence', { p_site_id: profile.site_id }).maybeSingle();
    if (geoErr) throw geoErr;
    if (!geo) return; // gym has no location configured yet

    const regions: Location.LocationRegion[] = [
      {
        identifier: profile.site_id,
        latitude: geo.lat,
        longitude: geo.lng,
        // The proximity alert's own trigger distance (default 200m) — independent of `geo.radius`,
        // which is the (tighter) check-in validation radius `check_in()` enforces server-side.
        radius: geo.proximity_radius,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ].slice(0, MAX_IOS_REGIONS);

    await Location.startGeofencingAsync(GYM_GEOFENCE_TASK, regions);
  } catch (e) {
    logger.error('geofence.sync_failed', e);
  }
}

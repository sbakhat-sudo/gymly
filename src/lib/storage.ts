import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { OccupancySchema, Rfc3339UtcSchema, SiteIdSchema, TimeOfDaySchema } from '@/schemas';

import { isValidAlertWindow } from './domain/alerts';
import { CheckinRecordSchema } from './domain/checkin';
import { logger } from './logger';

/**
 * The ONLY module that touches AsyncStorage. Non-sensitive preferences only — never personal data,
 * never tokens (a real member token would belong in expo-secure-store). Every key has a schema:
 * writes are validated, and reads are validated too, so a corrupted or tampered value is discarded
 * instead of crashing the app.
 */
const PREFIX = 'gymly.v1.';

const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const STORAGE_SCHEMAS = {
  /** Chosen gym. */
  siteId: SiteIdSchema,
  lang: z.enum(['it', 'en']),
  /** Green alerts opt-in (the OS permission is requested separately, only from the 2nd session). */
  alertOptIn: z.boolean(),
  alertWindow: z.object({ from: TimeOfDaySchema, to: TimeOfDaySchema }).refine(isValidAlertWindow),
  /** Local date of the last green alert sent: enforces "at most once a day". */
  lastAlertDate: DateKeySchema,
  /** App launches so far: the notification prompt is offered only from the 2nd one. */
  sessionCount: z.number().int().min(0).max(1_000_000),
  /** The member has already seen a band: the notification prompt may now be offered. */
  valueSeen: z.boolean(),
  /** Demo stand-in for "membership card linked" (a fictional id only; see `GymlyApi.getMe`). */
  memberSiteId: SiteIdSchema,
  /** Last occupancy payload, kept to show (clearly labelled) while offline. Contains no people count. */
  cachedOccupancy: z.object({ siteId: SiteIdSchema, savedAt: Rfc3339UtcSchema, payload: OccupancySchema }),
  /** Present only while the member is checked in; removed (not set to a falsy value) on check-out. */
  checkin: CheckinRecordSchema,
  /** Check-in reminder notifications opt-in (separate from the "gym is quiet" alerts opt-in). */
  checkinNotifOptIn: z.boolean(),
  /** Identifiers of the currently scheduled check-in notifications, to cancel them on check-out/confirm. */
  checkinNotificationIds: z.object({ stillHere: z.string().nullable(), autoCheckout: z.string().nullable() }),
  /** Same idea as `checkinNotificationIds`, but for a real Client's repeating "sei ancora qui?"
   * series (`notifications.ts#scheduleRepeatingStillHereReminders`) — a separate key because the
   * shape differs (a list, not a fixed pair) and because a real Client never has an autoCheckout
   * notification to track. */
  realCheckinNotificationIds: z.array(z.string()),
  /** Appearance: 'auto' follows the OS scheme and reacts live; 'light'/'dark' force it. */
  themePref: z.enum(['auto', 'light', 'dark']),
  /** "Guarda l'affluenza senza account" chosen on Benvenuto: the member app opens without signing in. */
  guest: z.boolean(),
  /** Role/gym choice collected on the signup screen, before the account exists. Replayed once a
   * session is available (immediately, or after email confirmation) so the member never has to
   * re-enter it; cleared right after. Coach/Client only — Manager has its own `pendingManagerPlan`. */
  pendingRegistration: z.object({
    role: z.enum(['client', 'coach']),
    fullName: z.string(),
    phone: z.string(),
    siteId: SiteIdSchema.nullable(),
  }),
  /** The plan (+ full name, same reason `pendingRegistration` keeps one) a prospective Manager
   * picked on the signup screen, before the account exists. Replayed the same way as
   * `pendingRegistration` once a session is available. */
  pendingManagerPlan: z.object({ plan: z.enum(['trial', 'pro', 'business']), fullName: z.string() }),
  /** Same role as `pendingManagerPlan`, for the Owner's own signup (`OwnerSignupScreen.tsx`) —
   * Manager no longer self-registers at all, this is its replacement. */
  pendingOwnerPlan: z.object({ plan: z.enum(['trial', 'pro', 'business']), fullName: z.string() }),
  /** The last geofence "you're near the gym" notification `geofenceTask.ts` actually sent —
   * debounces it to at most once an hour. One fixed key, not one per site, is enough: a client
   * belongs to exactly one gym (see `useSyncGeofences.ts`'s own comment on the same constraint). */
  geofenceLastNotify: z.object({ siteId: SiteIdSchema, sentAt: Rfc3339UtcSchema }),
  /** Newest `broadcasts.created_at` the Manager has opened the notifications panel since — anything
   * newer counts as unread (ManagerNotifications.tsx). `null` until the panel's been opened once. */
  managerLastSeenBroadcastAt: Rfc3339UtcSchema.nullable(),
  /** IDs (`request-<userId>` / `issue-<id>`) of pending requests/issues the Manager has tapped
   * through to, or marked read in bulk — a watermark timestamp doesn't work for these the way it
   * does for broadcasts, since the Manager can open an older one after a newer one without that
   * meaning everything older is now "seen" too. Capped (see `ManagerNotifications.tsx`) so this
   * can't grow forever as items get approved/resolved and drop off the pending list. */
  managerSeenNotificationIds: z.array(z.string()).max(500),
  /** Same idea as `managerSeenNotificationIds`, for the Coach's own unanswered-rating bell. */
  coachSeenNotificationIds: z.array(z.string()).max(500),
  /** The real Client's own weekly check-in target, chosen in Impostazioni — local-only, like
   * lang/theme, never synced server-side. Defaults to 3 when unset. */
  weeklyGoal: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  /** Set right after a checkout that has something to say (goal progress or just reached) — the
   * Home screen reads and clears it once, so the popup "appears right after check-out" without the
   * Check-in tab needing to navigate anywhere itself. */
  pendingGoalMessage: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('progress'), remaining: z.number().int().min(1).max(10) }),
    z.object({ kind: z.literal('reached') }),
  ]),
  /** The Monday (`YYYY-MM-DD`, local calendar) of the last week whose "goal missed" popup has
   * already been shown — there's no real scheduled push in this project (Expo Go constraint), so
   * this is checked on the Home screen's own mount instead; this key stops it from repeating every
   * time the Client opens the app during the following week. */
  goalWeekMessageShownFor: DateKeySchema,
  /** Resolved-issue banner ids (`ResolvedIssueBanner.tsx`) the Client has dismissed themselves — a
   * banner stays until the Client clears it or it naturally drops off tomorrow (`getMyIssuesResolvedToday`
   * stops returning it), whichever comes first. Capped the same way `managerSeenNotificationIds` is,
   * so a very active gym's full history of dismissed banners can't grow this key forever. */
  dismissedResolvedIssueIds: z.array(z.number().int()).max(200),
} as const;

export type StorageKey = keyof typeof STORAGE_SCHEMAS;
export type StorageValue<K extends StorageKey> = z.output<(typeof STORAGE_SCHEMAS)[K]>;

function schemaFor<K extends StorageKey>(key: K): z.ZodType<StorageValue<K>> {
  // The map's value type is a union of schemas; the generic key narrows it. One contained cast.
  return STORAGE_SCHEMAS[key] as unknown as z.ZodType<StorageValue<K>>;
}

export const storage = {
  async get<K extends StorageKey>(key: K): Promise<StorageValue<K> | undefined> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(PREFIX + key);
    } catch (e) {
      logger.error('storage.read_failed', e);
      return undefined;
    }
    if (raw === null) return undefined;

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      await storage.remove(key);
      return undefined;
    }
    const parsed = schemaFor(key).safeParse(json);
    if (!parsed.success) {
      logger.warn('storage.invalid_value_discarded', { key });
      await storage.remove(key);
      return undefined;
    }
    return parsed.data;
  },

  /** Throws on a value that violates the key's schema (a programming error, not a runtime condition). */
  async set<K extends StorageKey>(key: K, value: StorageValue<K>): Promise<void> {
    const checked = schemaFor(key).parse(value);
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(checked));
    } catch (e) {
      logger.error('storage.write_failed', e);
    }
  },

  async remove(key: StorageKey): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch (e) {
      logger.error('storage.remove_failed', e);
    }
  },

  /** "Cancella i miei dati": wipes everything this app stored locally. */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      logger.error('storage.clear_failed', e);
      throw e;
    }
  },
};

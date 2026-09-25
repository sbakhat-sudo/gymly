import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { OccupancySchema, Rfc3339UtcSchema, SiteIdSchema, TimeOfDaySchema } from '@/schemas';

import { isValidAlertWindow } from './domain/alerts';
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
  /** "Modalità demo" toggle in Settings (shows the Demo panel). */
  demoMode: z.boolean(),
  /** Last occupancy payload, kept to show (clearly labelled) while offline. Contains no people count. */
  cachedOccupancy: z.object({ siteId: SiteIdSchema, savedAt: Rfc3339UtcSchema, payload: OccupancySchema }),
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

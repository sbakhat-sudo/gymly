import { useEffect, useRef, useState } from 'react';

import { elapsedSecondsSince, resolveCheckinPhase, type CheckinPhase, type CheckinRecord } from '@/lib/domain/checkin';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import {
  addCheckinResponseListener,
  cancelCheckinReminders,
  requestAlertPermission,
  scheduleCheckinReminders,
  type CheckinNotificationIds,
} from '@/lib/notifications';
import { useApi } from '@/lib/services-context';
import { storage } from '@/lib/storage';
import { toApiError } from '@/lib/use-async';
import { toIsoSeconds } from '@/lib/format';

const NO_IDS: CheckinNotificationIds = { stillHere: null, autoCheckout: null };

/**
 * `{ server: string }` is only ever produced by `useRealCheckin`'s geofenced check-in: the RPC's
 * own raised message (already a clear, ready-to-show Italian sentence — too far, not approved,
 * already checked in recently), shown as-is instead of a generic `t('checkin.error.generic')`.
 */
export type CheckinNotice = 'offline' | 'generic' | 'autoCheckedOut' | 'locationTimeout' | { server: string };

export interface UseCheckinResult {
  /** Still reading AsyncStorage. */
  loading: boolean;
  /** null = not checked in (here or at another gym). */
  phase: CheckinPhase | null;
  elapsedSeconds: number;
  notifOptIn: boolean;
  notifNotice: 'denied' | 'unsupported' | null;
  notice: CheckinNotice | null;
  busy: boolean;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  confirmStillHere: () => Promise<void>;
  toggleNotify: (next: boolean) => Promise<void>;
  dismissNotice: () => void;
}

/**
 * Owns the member's check-in state for one gym: persistence (AsyncStorage), the mock API's
 * presence nudge, and the two local notifications (90-min "sei ancora qui?" + 105-min auto
 * check-out heads-up). The auto check-out itself is never driven by a notification firing — see
 * `domain/checkin.ts` — it is derived from `phase` every second while this hook is mounted.
 *
 * `site` is nullable so this can be called unconditionally from a single provider mounted above
 * the whole `(client)` tree (before a gym is even chosen) — see `checkin-context.tsx`. Calling this
 * hook a second time for the same gym (e.g. from a screen) would double-schedule notifications and
 * double-run the auto check-out effect, so screens must consume the shared context instead.
 */
export function useCheckin(site: { site_id: string; name: string } | null): UseCheckinResult {
  const api = useApi();
  const { lang } = useI18n();
  const appActive = useAppActive();
  const now = useNow(1000, appActive);
  const siteId = site?.site_id ?? null;

  const [record, setRecord] = useState<CheckinRecord | null | undefined>(undefined);
  const [notifOptIn, setNotifOptIn] = useState(false);
  const [notifNotice, setNotifNotice] = useState<'denied' | 'unsupported' | null>(null);
  const [notice, setNotice] = useState<CheckinNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const notifIds = useRef<CheckinNotificationIds>(NO_IDS);

  useEffect(() => {
    let alive = true;
    // No site yet (first launch, before a gym is chosen): resolve trivially, but only inside the
    // .then() below — setRecord still only ever runs after an await, never synchronously in the effect body.
    const loadCheckin = siteId ? storage.get('checkin') : Promise.resolve(undefined);
    void Promise.all([loadCheckin, storage.get('checkinNotifOptIn'), storage.get('checkinNotificationIds')]).then(
      ([r, optIn, ids]) => {
        if (!alive) return;
        setRecord(r && siteId && r.siteId === siteId ? r : null);
        setNotifOptIn(optIn ?? false);
        notifIds.current = ids ?? NO_IDS;
      }
    );
    return () => {
      alive = false;
    };
  }, [siteId]);

  const phase = record ? resolveCheckinPhase(record, now) : null;
  const elapsedSeconds = record ? elapsedSecondsSince(record, now) : 0;

  async function doCheckIn(): Promise<void> {
    if (!site) return;
    setNotice(null);
    setBusy(true);
    try {
      await api.checkIn(site.site_id);
      const nowIso = toIsoSeconds(new Date(now));
      const next: CheckinRecord = { siteId: site.site_id, checkinAt: nowIso, lastConfirmedAt: nowIso };
      await storage.set('checkin', next);
      setRecord(next);
      if (notifOptIn) {
        const ids = await scheduleCheckinReminders(lang, site.name);
        notifIds.current = ids;
        await storage.set('checkinNotificationIds', ids);
      }
    } catch (e) {
      setNotice(toApiError(e).code === 'network' ? 'offline' : 'generic');
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut(auto: boolean): Promise<void> {
    if (!record) return;
    if (!auto) {
      setNotice(null);
      setBusy(true);
    }
    try {
      await api.checkOut(record.siteId);
      await cancelCheckinReminders(notifIds.current);
      notifIds.current = NO_IDS;
      await storage.remove('checkin');
      await storage.remove('checkinNotificationIds');
      setRecord(null);
      if (auto) setNotice('autoCheckedOut');
    } catch (e) {
      // Offline auto check-out: the local record stays put and `phase` is recomputed (and retried) every tick.
      if (!auto) setNotice(toApiError(e).code === 'network' ? 'offline' : 'generic');
    } finally {
      if (!auto) setBusy(false);
    }
  }

  async function confirmStillHere(): Promise<void> {
    if (!record || !site) return;
    setNotice(null);
    const next: CheckinRecord = { ...record, lastConfirmedAt: toIsoSeconds(new Date(now)) };
    await storage.set('checkin', next);
    setRecord(next);
    await cancelCheckinReminders(notifIds.current);
    if (notifOptIn) {
      const ids = await scheduleCheckinReminders(lang, site.name);
      notifIds.current = ids;
      await storage.set('checkinNotificationIds', ids);
    } else {
      notifIds.current = NO_IDS;
      await storage.remove('checkinNotificationIds');
    }
  }

  async function toggleNotify(next: boolean): Promise<void> {
    setNotifNotice(null);
    if (!next) {
      await storage.set('checkinNotifOptIn', false);
      setNotifOptIn(false);
      await cancelCheckinReminders(notifIds.current);
      notifIds.current = NO_IDS;
      await storage.remove('checkinNotificationIds');
      return;
    }
    const result = await requestAlertPermission();
    if (result !== 'granted') {
      setNotifNotice(result === 'denied' ? 'denied' : 'unsupported');
      return;
    }
    await storage.set('checkinNotifOptIn', true);
    setNotifOptIn(true);
    if (record && site) {
      const ids = await scheduleCheckinReminders(lang, site.name);
      notifIds.current = ids;
      await storage.set('checkinNotificationIds', ids);
    }
  }

  // Purely time-derived (no background timer): reaching `autoCheckedOut` while this screen is open
  // performs the check-out then and there. If the app was closed the whole time, the same thing
  // happens honestly on the very next render once `now` catches up — nothing is ever guessed.
  useEffect(() => {
    // `doCheckOut` only sets state after awaiting the API, never synchronously: the rule cannot see through it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase === 'autoCheckedOut') void doCheckOut(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // "Latest" ref so the OS-triggered action buttons (registered once) never act on stale state.
  // Updated from an effect (runs after every render), never written during render itself.
  const latest = useRef({ doCheckIn, doCheckOut, confirmStillHere });
  useEffect(() => {
    latest.current = { doCheckIn, doCheckOut, confirmStillHere };
  });
  useEffect(() => {
    return addCheckinResponseListener({
      onStillHereYes: () => void latest.current.confirmStillHere(),
      onStillHereNo: () => void latest.current.doCheckOut(false),
      onProximityCheckin: () => void latest.current.doCheckIn(),
    });
  }, []);

  return {
    loading: record === undefined,
    phase,
    elapsedSeconds,
    notifOptIn,
    notifNotice,
    notice,
    busy,
    checkIn: doCheckIn,
    checkOut: () => doCheckOut(false),
    confirmStillHere,
    toggleNotify,
    dismissNotice: () => setNotice(null),
  };
}

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { getOpenCheckin, getOwnCheckinHistory, realCheckInWithLocation, realCheckOut, realConfirmStillHere, type OpenCheckin } from '@/lib/checkins-api';
import { elapsedSecondsSince, resolveCheckinPhase, startOfWeek, type CheckinPhase } from '@/lib/domain/checkin';
import { computeCheckoutGoalMessage } from '@/lib/domain/weekly-goal';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { addCheckinResponseListener, cancelRepeatingReminders, hasPendingStillHereReminders, requestAlertPermission, scheduleRepeatingStillHereReminders } from '@/lib/notifications';
import { storage } from '@/lib/storage';

import type { CheckinNotice, UseCheckinResult } from './use-checkin';

const NO_IDS: readonly string[] = [];

// `getCurrentPositionAsync` has no built-in timeout and, per Expo's own docs, "may take some time to
// resolve, especially when you're inside a building" — exactly where every check-in happens. Without
// this, a poor GPS/Wi-Fi fix leaves the button stuck on `busy` forever with zero feedback, which is
// indistinguishable from "non funziona" to whoever is tapping it.
const LOCATION_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location_timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Same shape as `useCheckin` (so `FloatingTabBar` and the Check-in tab can share one instance via
 * `CheckinContext` regardless of which hook backs it), but for a real, approved Client: persisted
 * in the real `checkins` table (`kind: 'client'`) instead of AsyncStorage, so it shows up in the
 * Manager's "chi c'è ora" list. Unlike the mock flow there is no opt-in toggle in the UI (no screen
 * renders `notifOptIn`/`toggleNotify` for a real Client) — the 90-min "sei ancora qui?" reminder is
 * scheduled unconditionally on check-in, repeating every 10 minutes after that
 * (`notifications.ts#scheduleRepeatingStillHereReminders`), permission requested right then since
 * that is exactly the moment the feature is used. The Coach presence flow intentionally has none of
 * this — a coach checks in/out freely with no reminder.
 *
 * A real Client is checked out by the SERVER, never by a timer here (a confirmed product decision):
 * the moment the gym closes, and after 3 hours inside (`close_checkins()`, run every minute).
 * This hook only notices it: while a check-in is open it re-reads it every 30 seconds, and when the
 * server has closed it the screen goes back to "check-in" with a notice and the leftover reminders
 * are cancelled. Until then `resolveCheckinPhase`'s `autoCheckedOut` phase (the mock flow's 105
 * minutes) is capped back down to `awaitingConfirmation` below. A manual check-out is always possible.
 */
export function useRealCheckin(site: { site_id: string; name: string } | null): UseCheckinResult {
  const auth = useAuth();
  const { lang } = useI18n();
  const router = useRouter();
  const appActive = useAppActive();
  const now = useNow(1000, appActive);

  const [record, setRecord] = useState<OpenCheckin | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CheckinNotice | null>(null);
  const notifIds = useRef<readonly string[]>(NO_IDS);

  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const userEmail = auth.status === 'active' ? (auth.session.user.email ?? null) : null;
  const siteId = site?.site_id ?? null;

  useEffect(() => {
    let alive = true;
    const load = userId && siteId ? getOpenCheckin(userId, siteId, 'client') : Promise.resolve(null);
    void Promise.all([load, storage.get('realCheckinNotificationIds')]).then(([r, ids]) => {
      if (!alive) return;
      setRecord(r);
      notifIds.current = r ? ids ?? NO_IDS : NO_IDS;
    });
    return () => {
      alive = false;
    };
  }, [userId, siteId]);

  const rawPhase = record && siteId ? resolveCheckinPhase({ siteId, checkinAt: record.checkinAt, lastConfirmedAt: record.lastConfirmedAt }, now) : null;
  // Never auto-checked-out: see the docstring above. Capped here instead of upstream in
  // `resolveCheckinPhase` so the guest/mock flow (`use-checkin.ts`) keeps its own, unrelated behaviour.
  const phase: CheckinPhase | null = rawPhase === 'autoCheckedOut' ? 'awaitingConfirmation' : rawPhase;
  const elapsedSeconds = record && siteId ? elapsedSecondsSince({ siteId, checkinAt: record.checkinAt, lastConfirmedAt: record.lastConfirmedAt }, now) : 0;

  // The server checks the Client out when the gym closes or after 3 hours: while a check-in is open, look again every
  // 30 seconds (and as soon as the app comes back to the foreground) and, once it is gone, show the check-in screen
  // again with a notice and drop the reminders that were still waiting.
  useEffect(() => {
    if (!userId || !siteId || !record || !appActive) return;
    let alive = true;
    const openId = record.id;
    const check = (): void => {
      getOpenCheckin(userId, siteId, 'client').then(
        async (current) => {
          if (!alive || (current && current.id === openId)) return;
          if (current) {
            setRecord(current);
            return;
          }
          setRecord(null);
          setNotice('autoCheckedOut');
          try {
            await cancelRepeatingReminders(notifIds.current);
            notifIds.current = NO_IDS;
            await storage.remove('realCheckinNotificationIds');
          } catch (e) {
            logger.error('checkin.auto_checkout_cleanup_failed', e);
          }
        },
        () => undefined
      );
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId, siteId, record, appActive]);

  // A check-in that is still open but whose reminders are gone (cleared by mistake, or the phone restarted) gets them
  // again, from the moment of the check-in itself — so "sei ancora in palestra?" never goes missing.
  const restoredFor = useRef<number | null>(null);
  useEffect(() => {
    if (!record || !userId || !site || restoredFor.current === record.id) return;
    restoredFor.current = record.id;
    void (async () => {
      if (await hasPendingStillHereReminders(userId)) return;
      const ids = await scheduleRepeatingStillHereReminders(lang, site.name, userId, userEmail, Date.parse(record.checkinAt));
      if (ids.length > 0) {
        notifIds.current = ids;
        await storage.set('realCheckinNotificationIds', ids);
      }
    })();
  }, [record, userId, userEmail, site, lang]);

  async function doCheckIn(): Promise<void> {
    if (!userId || !siteId || !site) return;
    setNotice(null);
    setBusy(true);
    try {
      // `Balanced` (network/Wi-Fi assisted) resolves in a couple of seconds even indoors, unlike
      // `High` (GPS-grade) — the server's own geofence tolerance (site radius + 50m) easily absorbs
      // the lower precision, so there's no accuracy trade-off worth a much slower, often-stuck fix.
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
      try {
        const next = await realCheckInWithLocation(siteId, position.coords.latitude, position.coords.longitude, position.mocked ?? false);
        setRecord(next);
        const permission = await requestAlertPermission();
        if (permission === 'granted') {
          const ids = await scheduleRepeatingStillHereReminders(lang, site.name, userId, userEmail);
          notifIds.current = ids;
          await storage.set('realCheckinNotificationIds', ids);
        }
      } catch (e) {
        // The RPC's own raised message is already a clear, ready-to-show Italian sentence. Duck-typed
        // instead of `instanceof Error`: supabase-js's PostgrestError doesn't reliably pass that check.
        const message = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : null;
        setNotice(message ? { server: message } : 'generic');
      }
    } catch (e) {
      const timedOut = e instanceof Error && e.message === 'location_timeout';
      logger.error(timedOut ? 'checkin.location_timeout' : 'checkin.location_failed', e);
      setNotice(timedOut ? 'locationTimeout' : 'generic');
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut(): Promise<void> {
    if (!record) return;
    const checkinId = record.id;
    setNotice(null);
    setBusy(true);

    try {
      await realCheckOut(checkinId);
    } catch {
      setNotice('generic');
      setBusy(false);
      return;
    }

    // Check-out itself already succeeded above. Everything below is best-effort local cleanup
    // (cancelling reminders, clearing storage) — it must never swallow that success behind a
    // "generic error" notice if one of these steps happens to fail.
    try {
      await cancelRepeatingReminders(notifIds.current);
      notifIds.current = NO_IDS;
      await storage.remove('realCheckinNotificationIds');
    } catch (e) {
      logger.error('checkin.post_checkout_cleanup_failed', e);
    }

    setRecord(null);
    setBusy(false);

    // Weekly-goal popup: best-effort, same reasoning as the cleanup block above — it must never
    // turn a successful checkout into an error notice. There's no real scheduled push in this
    // project (Expo Go constraint), so this just leaves a note for the Home screen to pick up and
    // show on its own next mount (`WeeklyGoalPopup.tsx`), which is what "appears right after
    // check-out, on the home screen" actually means here.
    if (userId && siteId) {
      try {
        const goal = (await storage.get('weeklyGoal')) ?? 3;
        const history = await getOwnCheckinHistory(userId, siteId, 'client');
        const weekStart = startOfWeek(Date.now());
        const sessionsThisWeek = history.filter((h) => h.checkoutAt !== null && Date.parse(h.checkinAt) >= weekStart).length;
        const message = computeCheckoutGoalMessage(sessionsThisWeek, goal);
        if (message) await storage.set('pendingGoalMessage', message);
      } catch (e) {
        logger.error('checkin.weekly_goal_compute_failed', e);
      }
    }

    // Pop the feedback modal right away, same visit still fresh in mind — it self-closes after a
    // couple of minutes if left untouched (`auto=1`, read by `SubmitFeedbackScreen`'s countdown).
    // The Client can still always reach the same check-out later from the standalone Feedback tab's
    // own check-out picker (`ClientFeedbackScreen.tsx`), which is unaffected by this.
    router.push({ pathname: '/feedback/[checkinId]', params: { checkinId: String(checkinId), auto: '1' } });
  }

  async function doConfirmStillHere(): Promise<void> {
    if (!record || !site || !userId) return;
    setNotice(null);
    const nowIso = await realConfirmStillHere(record.id);
    setRecord({ ...record, lastConfirmedAt: nowIso });
    await cancelRepeatingReminders(notifIds.current);
    const permission = await requestAlertPermission();
    if (permission === 'granted') {
      const ids = await scheduleRepeatingStillHereReminders(lang, site.name, userId, userEmail);
      notifIds.current = ids;
      await storage.set('realCheckinNotificationIds', ids);
    } else {
      notifIds.current = NO_IDS;
      await storage.remove('realCheckinNotificationIds');
    }
  }

  // "Latest" ref so the OS-triggered action buttons (registered once) never act on stale state —
  // same pattern as `use-checkin.ts`.
  const latest = useRef({ doCheckOut, doConfirmStillHere, userId });
  useEffect(() => {
    latest.current = { doCheckOut, doConfirmStillHere, userId };
  });
  useEffect(() => {
    return addCheckinResponseListener(
      {
        onStillHereYes: () => void latest.current.doConfirmStillHere(),
        onStillHereNo: () => void latest.current.doCheckOut(),
        onProximityCheckin: () => {},
      },
      () => latest.current.userId
    );
  }, []);

  return {
    loading: record === undefined,
    phase,
    elapsedSeconds,
    notifOptIn: false,
    notifNotice: null,
    notice,
    busy,
    checkIn: doCheckIn,
    checkOut: doCheckOut,
    confirmStillHere: doConfirmStillHere,
    toggleNotify: async () => {},
    dismissNotice: () => setNotice(null),
  };
}

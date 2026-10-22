import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { getOwnCheckinHistory } from '@/lib/checkins-api';
import { startOfWeek } from '@/lib/domain/checkin';
import { formatDateKey, type GoalPopupMessage } from '@/lib/domain/weekly-goal';
import { storage } from '@/lib/storage';

import { GoalMessageDialog } from './GoalMessageDialog';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mounted on the real Client's Home screen. Two independent sources, checked every time Home gains
 * focus — not just once on mount: Expo Router's tab navigator keeps every tab's screen mounted and
 * merely hides the inactive ones, so a plain mount-only effect here only ever ran once, the very
 * first time the app loaded, and never again when the Client checked out from the Check-in tab and
 * came back to Home — `useIsFocused()` (already used the same way in `RealClientScheduleScreen.tsx`)
 * is what actually re-runs this on every return to the tab.
 *  1. A message a just-finished checkout left behind (`pendingGoalMessage` — progress or "goal
 *     reached"), read once and cleared, so it only ever shows once.
 *  2. Whether LAST week's goal was missed — there's no real scheduled push in this project (Expo Go
 *     constraint), so "a scheduled end-of-week check" becomes "checked whenever the Client next
 *     opens the app", gated by `goalWeekMessageShownFor` so it only appears once per week and never
 *     for a brand-new Client with no history yet.
 */
export function WeeklyGoalPopup() {
  const auth = useAuth();
  const focused = useIsFocused();
  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const [message, setMessage] = useState<GoalPopupMessage | null>(null);

  useEffect(() => {
    if (!focused) return;
    let alive = true;
    (async () => {
      const pending = await storage.get('pendingGoalMessage');
      if (pending) {
        await storage.remove('pendingGoalMessage');
        if (alive) setMessage(pending);
        return;
      }

      if (!userId || !siteId) return;
      const now = Date.now();
      const thisWeekStart = startOfWeek(now);
      const lastWeekStart = thisWeekStart - WEEK_MS;
      const lastWeekKey = formatDateKey(new Date(lastWeekStart));
      const alreadyShownFor = await storage.get('goalWeekMessageShownFor');
      if (alreadyShownFor === lastWeekKey) return;

      const history = await getOwnCheckinHistory(userId, siteId, 'client');
      if (history.length === 0) return; // never nag a brand-new Client on their very first open
      const goal = (await storage.get('weeklyGoal')) ?? 3;
      const sessionsLastWeek = history.filter(
        (h) => h.checkoutAt !== null && Date.parse(h.checkinAt) >= lastWeekStart && Date.parse(h.checkinAt) < thisWeekStart
      ).length;

      await storage.set('goalWeekMessageShownFor', lastWeekKey);
      if (sessionsLastWeek < goal && alive) setMessage({ kind: 'missed' });
    })();
    return () => {
      alive = false;
    };
  }, [userId, siteId, focused]);

  if (!message) return null;
  return <GoalMessageDialog message={message} onClose={() => setMessage(null)} />;
}

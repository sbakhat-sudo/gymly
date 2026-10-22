import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { StarFilledIcon } from '@/components/icons';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationsSheet, type NotificationListItem } from '@/components/NotificationsSheet';
import { formatDateKey } from '@/lib/domain/weekly-goal';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useSelectedDate } from '@/lib/selected-date-context';
import { storage } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getMyRatings, type CoachRatingEntry } from './coach-api';

const POLL_MS = 20_000;
const SEEN_IDS_CAP = 500;

/**
 * The Coach's bell: how "manda una notifica al coach" (spec) actually surfaces, given this project
 * has no real push backend (Expo Go constraint, see CLAUDE.md) — same pull-based pattern as
 * `ManagerNotifications`/`ClientNotifications`, polling while the app is open rather than a true
 * background push. Lists the Coach's own ratings with no reply yet (`coachReply === null`) as a
 * scrollable list (`NotificationsSheet`, shared with `ManagerNotifications`); tapping one marks it
 * seen (`coachSeenNotificationIds`, per-item — same reasoning as `ManagerNotifications`'s own: a
 * single "last seen" watermark can't tell an older-but-just-opened rating from a newer one still
 * sitting unread) and jumps to "I miei Feedback" where the full list — and the reply box — already
 * renders. A rating that's actually been replied to drops out of this list entirely regardless of
 * its seen status, same as before.
 *
 * In sidebar mode (wide web), `RoleTopBar` (`(coach)/_layout.tsx`) renders one copy of this bell
 * fixed above every screen instead, passing `hideInSidebarMode={false}` so *that* instance still
 * shows — every other call site (unchanged, still just `<CoachNotifications />` inline in each
 * screen) renders nothing there, so screens don't end up with two bells. On a narrow window or
 * native, where there's no sidebar/top-bar, every call renders inline exactly as before.
 */
export function CoachNotifications({ hideInSidebarMode = true }: { hideInSidebarMode?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const appActive = useAppActive();
  const isSidebar = useSidebarMode();
  const { setDateKey } = useSelectedDate();
  const [unanswered, setUnanswered] = useState<CoachRatingEntry[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    storage.get('coachSeenNotificationIds').then((v) => setSeenIds(v ?? []));
  }, []);

  function markSeen(ids: string[]): void {
    setSeenIds((prev) => {
      const next = [...prev.filter((id) => !ids.includes(id)), ...ids].slice(-SEEN_IDS_CAP);
      void storage.set('coachSeenNotificationIds', next);
      return next;
    });
  }

  useEffect(() => {
    // Skip the poll entirely for a hidden inline instance (sidebar mode) — the `RoleTopBar` copy
    // is already polling for the same data, no need to pay for it twice.
    if (!appActive || (isSidebar && hideInSidebarMode)) return;
    let alive = true;
    const load = (): void => {
      getMyRatings().then(
        (ratings) => alive && setUnanswered(ratings.filter((r) => r.coachReply === null)),
        () => undefined
      );
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [appActive, isSidebar, hideInSidebarMode]);

  if (isSidebar && hideInSidebarMode) return null;

  const unreadCount = unanswered.filter((r) => !seenIds.includes(`rating-${r.id}`)).length;

  const items: NotificationListItem[] = unanswered.map((r) => {
    const id = `rating-${r.id}`;
    return {
      id,
      icon: StarFilledIcon,
      tint: theme.band.amber.solid,
      title: t('coach.notifications.item', { client: r.clientName }),
      description: r.comment ?? undefined,
      createdAt: r.createdAt,
      read: seenIds.includes(id),
      // Marks it seen and jumps the shared date picker to this rating's own day first — otherwise
      // an older unanswered rating could navigate to a list still filtered to today and show empty.
      onPress: () => {
        markSeen([id]);
        setDateKey(formatDateKey(new Date(r.createdAt)));
        router.push('/(coach)/feedback');
      },
    };
  });

  function markAllRead(): void {
    markSeen(unanswered.map((r) => `rating-${r.id}`));
  }

  return (
    <>
      <NotificationBell count={unreadCount} showCount onPress={() => setOpen(true)} accessibilityLabel={t('coach.notifications.title', { n: unreadCount })} />

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} items={items} onMarkAllRead={markAllRead} emptyLabel={t('coach.notifications.empty')} />
    </>
  );
}

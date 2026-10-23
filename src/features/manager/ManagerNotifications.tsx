import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AlertTriangleIcon, InboxIcon } from '@/components/icons';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationsSheet, type NotificationListItem } from '@/components/NotificationsSheet';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateKey } from '@/lib/domain/weekly-goal';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useSelectedDate } from '@/lib/selected-date-context';
import { storage } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getIssues, getPendingRequests, type ManagerIssueEntry, type PendingRequest } from './manager-api';

const POLL_MS = 20_000;
const SEEN_IDS_CAP = 500;

/**
 * Everything that "arrives" for a Manager, in one place: new client signup requests and pending
 * (not yet resolved) issue reports — combined into one bell + a scrollable list (icon, title,
 * description, relative time, unread dot), with an explicit "Segna tutte lette" action and
 * All/Unread tabs (`NotificationsSheet`).
 *
 * "Read" is tracked per-item (`managerSeenNotificationIds`): the Manager can open an older one
 * after a newer one without that meaning everything older is now "seen" too, which a single
 * watermark couldn't express. Tapping an item marks *that* item seen; "Segna tutte lette" marks
 * everything currently listed seen at once.
 *
 * In sidebar mode (wide web), `RoleTopBar` (`(manager)/_layout.tsx`) renders one copy of this bell
 * fixed above every screen instead, passing `hideInSidebarMode={false}` so *that* instance still
 * shows — every other call site (unchanged, still just `<ManagerNotifications />` inline in each
 * screen) renders nothing there, so a screen's own title and this bell no longer drift apart as
 * the title's width changes from screen to screen. On a narrow window or native, every call
 * renders inline exactly as before.
 */
export function ManagerNotifications({ hideInSidebarMode = true }: { hideInSidebarMode?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const appActive = useAppActive();
  const isSidebar = useSidebarMode();
  const { setDateKey } = useSelectedDate();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [issues, setIssues] = useState<ManagerIssueEntry[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    storage.get('managerSeenNotificationIds').then((v) => setSeenIds(v ?? []));
  }, []);

  function markSeen(ids: string[]): void {
    setSeenIds((prev) => {
      const next = [...prev.filter((id) => !ids.includes(id)), ...ids].slice(-SEEN_IDS_CAP);
      void storage.set('managerSeenNotificationIds', next);
      return next;
    });
  }

  // Tapping a notification marks it seen and jumps the shared date picker to that item's own day
  // first — otherwise an older request/issue could navigate to a list still filtered to today and
  // show empty.
  function goTo(href: '/(manager)/richieste' | '/(manager)/issues', id: string, itemCreatedAt: string): void {
    markSeen([id]);
    setDateKey(formatDateKey(new Date(itemCreatedAt)));
    router.push(href);
  }

  useEffect(() => {
    // Skip the poll entirely for a hidden inline instance (sidebar mode) — the `RoleTopBar` copy
    // is already polling for the same data, no need to pay for it twice.
    if (!siteId || !appActive || (isSidebar && hideInSidebarMode)) return;
    let alive = true;
    const load = (): void => {
      getPendingRequests(siteId).then(
        (r) => alive && setRequests(r),
        () => undefined
      );
      getIssues().then(
        (all) => alive && setIssues(all.filter((i) => i.status === 'pending')),
        () => undefined
      );
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [siteId, appActive, isSidebar, hideInSidebarMode]);

  const unreadRequests = requests.filter((r) => !seenIds.includes(`request-${r.userId}`));
  const unreadIssues = issues.filter((i) => !seenIds.includes(`issue-${i.id}`));
  const totalCount = unreadRequests.length + unreadIssues.length;

  const items: NotificationListItem[] = [
    ...requests.map((r): NotificationListItem => {
      const id = `request-${r.userId}`;
      return {
        id,
        icon: InboxIcon,
        tint: theme.primary,
        title: t('manager.notifications.item.request'),
        description: r.fullName ?? undefined,
        createdAt: r.createdAt,
        read: seenIds.includes(id),
        onPress: () => goTo('/(manager)/richieste', id, r.createdAt),
      };
    }),
    ...issues.map((i): NotificationListItem => {
      const id = `issue-${i.id}`;
      return {
        id,
        icon: AlertTriangleIcon,
        tint: i.severity === 'urgent' ? theme.danger : theme.band.amber.solid,
        title: t('manager.notifications.item.issue', { client: i.clientName }),
        description: i.description ?? undefined,
        createdAt: i.createdAt,
        read: seenIds.includes(id),
        onPress: () => goTo('/(manager)/issues', id, i.createdAt),
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function markAllRead(): void {
    markSeen([...requests.map((r) => `request-${r.userId}`), ...issues.map((i) => `issue-${i.id}`)]);
  }

  if (isSidebar && hideInSidebarMode) return null;

  return (
    <>
      <NotificationBell count={totalCount} showCount onPress={() => setOpen(true)} accessibilityLabel={t('manager.notifications.title', { n: totalCount })} />

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} items={items} onMarkAllRead={markAllRead} emptyLabel={t('manager.notifications.empty')} />
    </>
  );
}

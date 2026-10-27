import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ClockIcon, InboxIcon } from '@/components/icons';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationsSheet, type NotificationListItem } from '@/components/NotificationsSheet';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

import { getOwners, getPendingOwners, type AdminOwnerRow, type PendingManager } from './admin-api';

const POLL_MS = 20_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Everything that needs the Admin's attention, in one bell: Owners waiting for approval, and Owners
 * whose plan isn't paid and are inside the automatic 3-day window (the last 24 hours are flagged
 * separately, the same moment the Owner's own banner turns into the "pay now" notice).
 *
 * Unlike `ManagerNotifications` there is no per-item "read" state: every item here is live state that
 * disappears on its own once Admin acts on it (approves the Owner, records the payment), so a
 * seen-marker could only ever hide something still unresolved.
 *
 * Rendered once, inside `RoleTopBar` in `(admin)/_layout.tsx` — sidebar mode only. A narrow window
 * keeps the dashboard header's own pending-approvals bell.
 */
export function AdminNotifications() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const appActive = useAppActive();

  const [pending, setPending] = useState<PendingManager[]>([]);
  const [unpaid, setUnpaid] = useState<AdminOwnerRow[]>([]);
  // "Now" as of the last poll — render itself must stay pure, and the list refreshes every POLL_MS anyway.
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appActive) return;
    let alive = true;
    const load = (): void => {
      getPendingOwners().then(
        (r) => alive && setPending(r),
        () => undefined
      );
      getOwners().then(
        (r) => {
          if (!alive) return;
          setUnpaid(r.filter((o) => o.planStatus === 'grace'));
          setNow(Date.now());
        },
        () => undefined
      );
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [appActive]);

  function goTo(href: '/(admin)/manager' | '/(admin)/owners'): void {
    setOpen(false);
    router.push(href);
  }

  const items: NotificationListItem[] = [
    ...pending.map(
      (o): NotificationListItem => ({
        id: `pending-${o.userId}`,
        icon: InboxIcon,
        tint: theme.primary,
        title: t('admin.notifications.item.pending'),
        description: [o.gymName ?? o.fullName, o.email].filter(Boolean).join(' · ') || undefined,
        avatar: { userId: o.userId, name: o.gymName ?? o.fullName },
        createdAt: o.createdAt,
        read: false,
        onPress: () => goTo('/(admin)/manager'),
      })
    ),
    ...unpaid.map((o): NotificationListItem => {
      const graceEnd = o.planGraceEnd ? new Date(o.planGraceEnd) : null;
      const lastDay = graceEnd !== null && graceEnd.getTime() - now < DAY_MS;
      return {
        id: `unpaid-${o.ownerId}`,
        icon: ClockIcon,
        tint: lastDay ? theme.danger : theme.band.amber.solid,
        title: t(lastDay ? 'admin.notifications.item.lastDay' : 'admin.notifications.item.unpaid'),
        description: t('admin.notifications.item.unpaidDesc', {
          owner: o.chainName || o.fullName || o.email,
          date: graceEnd ? graceEnd.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : '—',
        }),
        // When the plan fell due, i.e. when this notification "arrived".
        createdAt: o.planPaidUntil ?? o.createdAt,
        read: false,
        onPress: () => goTo('/(admin)/owners'),
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <NotificationBell count={items.length} showCount onPress={() => setOpen(true)} accessibilityLabel={t('admin.notifications.title', { n: items.length })} />

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} items={items} emptyLabel={t('admin.notifications.empty')} />
    </>
  );
}

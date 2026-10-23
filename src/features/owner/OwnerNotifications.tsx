import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { ClockIcon, MessageCircleIcon } from '@/components/icons';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationsSheet, type NotificationListItem } from '@/components/NotificationsSheet';
import { ChatModal } from '@/features/chat/ChatModal';
import { getConversations, type ChatConversation } from '@/features/chat/chat-api';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

import { getOwnerPlanBilling, type OwnerPlanBilling } from './owner-api';

const POLL_MS = 20_000;

/**
 * Everything that needs the Owner's attention, in one bell: new messages from their Managers (tapping one
 * opens the conversation right here, where they can read and answer) and, while the automatic 3-day window
 * is running, their own app plan not being paid — flagged separately for the last 24 hours before it is
 * switched off, the same moment the dashboard banner turns into the "pay now" notice.
 *
 * Like Admin's bell there is no per-item "seen" state: a message is unread until the thread is opened (the
 * server tracks that), and the plan notice disappears once Admin records the payment — so nothing here can
 * be dismissed while it is still unresolved. Rendered once, inside `RoleTopBar` in `(owner)/_layout.tsx`
 * (sidebar mode only; Owner is a web-only role).
 */
export function OwnerNotifications() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const appActive = useAppActive();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [billing, setBilling] = useState<OwnerPlanBilling | null>(null);
  const [chat, setChat] = useState<{ id: string; title: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appActive) return;
    let alive = true;
    const load = (): void => {
      getConversations().then(
        (c) => alive && setConversations(c),
        () => undefined
      );
      getOwnerPlanBilling().then(
        (b) => alive && setBilling(b),
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

  function refreshConversations(): void {
    getConversations().then(setConversations, () => undefined);
  }

  const unreadChats = conversations.filter((c) => c.unreadCount > 0);
  const planDue = billing !== null && billing.status === 'grace' && billing.graceEnd !== null;
  const totalCount = unreadChats.length + (planDue ? 1 : 0);

  const items: NotificationListItem[] = [
    ...conversations
      // A conversation nobody has written in yet isn't news.
      .filter((c) => c.lastBody !== null)
      .map((c): NotificationListItem => ({
        id: `chat-${c.conversationId}`,
        icon: MessageCircleIcon,
        tint: theme.primary,
        title: t('owner.notifications.item.message', { name: c.otherName || t('common.unnamedPerson') }),
        description: c.lastBody ?? undefined,
        createdAt: c.lastAt,
        read: c.unreadCount === 0,
        onPress: () => {
          setOpen(false);
          setChat({ id: c.conversationId, title: c.otherName || t('common.unnamedPerson') });
        },
      })),
    ...(planDue && billing?.graceEnd
      ? [
          {
            id: 'plan-due',
            icon: ClockIcon,
            // The server flips `warningSent` once the last 24 hours begin.
            tint: billing.warningSent ? theme.danger : theme.band.amber.solid,
            title: t(billing.warningSent ? 'owner.billing.lastDay.title' : 'owner.billing.grace.title'),
            description: t(billing.warningSent ? 'owner.billing.lastDay.body' : 'owner.billing.grace.body', {
              date: new Date(billing.graceEnd).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }),
            }),
            // When the plan fell due, i.e. when this notice "arrived".
            createdAt: billing.paidUntil ?? billing.graceEnd,
            read: false,
            onPress: () => {
              setOpen(false);
              router.push('/(owner)');
            },
          } satisfies NotificationListItem,
        ]
      : []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <NotificationBell count={totalCount} showCount onPress={() => setOpen(true)} accessibilityLabel={t('owner.notifications.title', { n: totalCount })} />

      <NotificationsSheet visible={open} onClose={() => setOpen(false)} items={items} emptyLabel={t('owner.notifications.empty')} />

      <ChatModal key={chat?.id ?? 'none'} conversationId={chat?.id ?? null} title={chat?.title ?? ''} onClose={() => setChat(null)} onChanged={refreshConversations} />
    </>
  );
}

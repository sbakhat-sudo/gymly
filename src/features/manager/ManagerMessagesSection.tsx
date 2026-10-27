import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { GroupHeader } from '@/components/GroupHeader';
import { MessageCircleIcon } from '@/components/icons';
import { ChatModal } from '@/features/chat/ChatModal';
import { getConversations, getMyOwner, openConversation, type ChatConversation } from '@/features/chat/chat-api';
import { avatarTint } from '@/lib/avatar-tint';
import { formatRelativeTime } from '@/lib/format';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

const POLL_MS = 10_000;

/**
 * The Manager's messages with their Owner, as a section of their Impostazioni (not a tab of its own):
 * every conversation, newest first, with an unread count — and, until one exists, a button to write to
 * the Owner first (the Owner could only ever reach the Manager before; the Manager had nowhere to start
 * one). Tapping a row opens the same in-screen `ChatModal` the Owner uses. Re-reads every few seconds
 * while the app is in the foreground, since nothing pushes into the app (no realtime/push service in
 * this project).
 */
export function ManagerMessagesSection() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const appActive = useAppActive();
  const conversations = useAsync(() => getConversations(), []);
  const owner = useAsync(() => getMyOwner(), []);
  const [chat, setChat] = useState<{ id: string; title: string; avatar?: { userId?: string | null; uri?: string | null } } | null>(null);
  const [startError, setStartError] = useState(false);

  const reloadConversations = conversations.reload;
  useEffect(() => {
    if (!appActive) return;
    const id = setInterval(reloadConversations, POLL_MS);
    return () => clearInterval(id);
  }, [appActive, reloadConversations]);

  const list = conversations.data ?? [];
  const ownerData = owner.data ?? null;
  const ownerName = ownerData?.ownerName || t('common.unnamedPerson');
  // Offer "write to your Owner" only while there is no conversation with them yet.
  const canStart = ownerData !== null && !list.some((c) => c.otherId === ownerData.ownerId);

  async function startWithOwner(): Promise<void> {
    if (!ownerData) return;
    setStartError(false);
    try {
      const id = await openConversation(ownerData.ownerId);
      setChat({ id, title: ownerName, avatar: { userId: ownerData.ownerId } });
      conversations.reload();
    } catch {
      setStartError(true);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <GroupHeader icon={MessageCircleIcon} label={t('manager.messages.title')} />

      {conversations.error ? <Banner title={t('manager.messages.error')} /> : null}
      {startError ? <Banner title={t('owner.managers.message.error')} /> : null}
      {conversations.data === undefined && conversations.loading ? <ActivityIndicator style={{ marginTop: spacing.md }} /> : null}

      {canStart ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
          <AppText muted style={{ fontSize: 13 }}>
            {t('manager.messages.startHint')}
          </AppText>
          <Button label={t('manager.messages.startWith', { name: ownerName })} onPress={() => void startWithOwner()} />
        </View>
      ) : null}

      {conversations.data && list.length === 0 && !canStart ? <EmptyState message={t('manager.messages.empty')} icon={MessageCircleIcon} /> : null}

      {list.map((c) => (
        <ConversationRow key={c.conversationId} conversation={c} lang={lang} onOpen={() => setChat({ id: c.conversationId, title: c.otherName || t('common.unnamedPerson'), avatar: { userId: c.otherId, uri: c.otherAvatarUrl } })} />
      ))}

      <ChatModal key={chat?.id ?? 'none'} conversationId={chat?.id ?? null} title={chat?.title ?? ''} avatar={chat?.avatar} onClose={() => setChat(null)} onChanged={reloadConversations} />
    </View>
  );
}

function ConversationRow({ conversation, lang, onOpen }: { conversation: ChatConversation; lang: 'it' | 'en'; onOpen: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const name = conversation.otherName || t('common.unnamedPerson');
  const unread = conversation.unreadCount;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${name}, ${t('manager.messages.unread', { n: unread })}` : name}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.card,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.85 : 1,
      })}>
      <ProfileAvatar userId={conversation.otherId} uri={conversation.otherAvatarUrl} name={conversation.otherName} size={44} tint={avatarTint(theme, conversation.otherName ?? conversation.otherId)} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 16, flexShrink: 1 }}>
            {name}
          </AppText>
          {conversation.lastBody ? (
            <AppText variant="caption" muted style={{ fontSize: 11.5 }}>
              {formatRelativeTime(lang, conversation.lastAt)}
            </AppText>
          ) : null}
        </View>
        <AppText numberOfLines={1} muted={unread === 0} style={{ fontSize: 13.5, fontWeight: unread > 0 ? '700' : '400' }}>
          {conversation.lastBody ?? t('manager.messages.noMessagesYet')}
        </AppText>
      </View>
      {unread > 0 ? (
        // A number, not just a coloured dot — never colour alone.
        <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary }}>
          <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 12 }}>{unread}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

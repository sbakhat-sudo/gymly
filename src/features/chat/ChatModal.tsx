import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { XIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth/auth-context';
import { useAppActive } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { CHAT_MAX_LENGTH, getMessages, markConversationRead, sendMessage, type ChatMessage } from './chat-api';

const POLL_MS = 5_000;

/**
 * One Owner <-> Manager conversation as an in-screen popup (same convention as the Owner's Manager
 * detail sheet — no separate route). Open whenever `conversationId` is set. Nothing pushes in the
 * background (this project has no realtime/push service), so while it is open it re-reads the thread
 * every few seconds and marks the other side's messages read as they arrive.
 *
 * Render it with `key={conversationId}`: switching conversations then starts from a clean state.
 */
export function ChatModal({
  conversationId,
  title,
  onClose,
  onChanged,
}: {
  conversationId: string | null;
  title: string;
  onClose: () => void;
  /** Called after messages were read or sent, so a caller showing an unread badge can refresh it. */
  onChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const appActive = useAppActive();
  const myId = 'session' in auth ? auth.session.user.id : null;

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const listRef = useRef<ScrollView>(null);
  // The latest `onChanged`, read from inside the poll below without making the poll restart whenever the
  // caller passes a new function.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (!conversationId || !appActive) return;
    let alive = true;
    const load = (): void => {
      getMessages(conversationId).then(
        (rows) => {
          if (!alive) return;
          setMessages(rows);
          setLoadError(false);
          if (rows.some((m) => m.senderId !== myId)) {
            markConversationRead(conversationId).then(
              () => alive && onChangedRef.current?.(),
              () => undefined
            );
          }
        },
        () => alive && setLoadError(true)
      );
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [conversationId, appActive, myId]);

  async function send(): Promise<void> {
    const body = draft.trim();
    if (!conversationId || body.length === 0 || sending) return;
    setSending(true);
    setSendError(false);
    try {
      await sendMessage(conversationId, body);
      setDraft('');
      setMessages(await getMessages(conversationId));
      onChangedRef.current?.();
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <Modal visible={conversationId !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 560, height: '80%', maxHeight: 720, borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <AppText variant="display" numberOfLines={1} style={{ fontSize: 20, flexShrink: 1 }}>
              {title}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <XIcon color={theme.text} size={20} />
            </Pressable>
          </View>

          {loadError ? <Banner title={t('chat.error')} /> : null}

          <ScrollView
            ref={listRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}>
            {messages === null && !loadError ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
            {messages?.length === 0 ? (
              <AppText muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
                {t('chat.empty')}
              </AppText>
            ) : null}
            {messages?.map((m) => {
              const mine = m.senderId === myId;
              return (
                <View
                  key={m.id}
                  accessible
                  accessibilityLabel={`${mine ? t('chat.you') : title}: ${m.body}`}
                  style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', gap: 2 }}>
                  <View
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm + 2,
                      borderRadius: radius.lg,
                      // The tail corner points at the sender's side, so who wrote it never relies on colour alone.
                      borderBottomRightRadius: mine ? 4 : radius.lg,
                      borderBottomLeftRadius: mine ? radius.lg : 4,
                      backgroundColor: mine ? theme.primary : theme.surfaceAlt,
                    }}>
                    <AppText style={{ color: mine ? theme.onPrimary : theme.text, fontSize: 15, lineHeight: 21 }}>{m.body}</AppText>
                  </View>
                  <AppText variant="caption" muted style={{ fontSize: 11, textAlign: mine ? 'right' : 'left' }}>
                    {new Date(m.createdAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                  </AppText>
                </View>
              );
            })}
          </ScrollView>

          {sendError ? <Banner title={t('chat.sendError')} /> : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void send()}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('chat.placeholder')}
              maxLength={CHAT_MAX_LENGTH}
              returnKeyType="send"
              blurOnSubmit={false}
              style={{ flex: 1, height: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, color: theme.text, fontSize: 15 }}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              style={{ minHeight: MIN_TAP, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? theme.primary : theme.surfaceAlt, opacity: canSend ? 1 : 0.6 }}>
              <AppText style={{ color: canSend ? theme.onPrimary : theme.textMuted, fontWeight: '700', fontSize: 14 }}>{t('chat.send')}</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

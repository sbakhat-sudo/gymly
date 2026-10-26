import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { AlertTriangleIcon, BellIcon, ChevronLeftIcon, ClockIcon, InfoIcon, PlusIcon, XIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { createAnnouncement, deleteAnnouncement, getAnnouncements, isExpired, type Announcement, type AnnouncementKind } from '@/features/announcements/announcements-api';
import { useNow } from '@/lib/hooks';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { ManagerNotifications } from './ManagerNotifications';

const KIND_KEY: Record<AnnouncementKind, TranslationKey> = {
  info: 'manager.announcements.kind.info',
  warning: 'manager.announcements.kind.warning',
  closure: 'manager.announcements.kind.closure',
};

/** How long a notice stays up, in days; `null` = until the Manager removes it. */
const DURATIONS: { key: TranslationKey; days: number | null }[] = [
  { key: 'manager.announcements.duration.day', days: 1 },
  { key: 'manager.announcements.duration.days3', days: 3 },
  { key: 'manager.announcements.duration.days7', days: 7 },
  { key: 'manager.announcements.duration.forever', days: null },
];

function useKindTint(): Record<AnnouncementKind, { color: string; icon: typeof InfoIcon }> {
  const theme = useTheme();
  return {
    info: { color: theme.primary, icon: InfoIcon },
    warning: { color: theme.band.amber.solid, icon: AlertTriangleIcon },
    closure: { color: theme.band.red.solid, icon: ClockIcon },
  };
}

/**
 * "Avvisi" — the Manager tells the gym's Clients something (a closure, a change of hours, a machine out of order).
 * A notice shows on the Client's home until it expires or is removed. No push notification (not available in
 * this project): members see it the next time they open the app.
 */
export function ManagerAnnouncementsScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const tints = useKindTint();
  const now = useNow(60_000);
  const list = useAsync(() => getAnnouncements(), []);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [actionError, setActionError] = useState(false);

  const dateLabel = (iso: string): string => new Date(iso).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function remove(a: Announcement): Promise<void> {
    setConfirmDelete(null);
    setActionError(false);
    try {
      await deleteAnnouncement(a.id);
      list.reload();
    } catch {
      setActionError(true);
    }
  }

  return (
    <Screen onRefresh={list.reload} refreshing={list.loading && list.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={BellIcon} label={t('manager.announcements.title')} notifications={<ManagerNotifications />} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
        <AppText muted style={{ flex: 1, minWidth: 220, fontSize: 14, lineHeight: 20 }}>
          {t('manager.announcements.subtitle')}
        </AppText>
        <Pressable
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.primary }}>
          <PlusIcon color={theme.onPrimary} size={16} strokeWidth={2.4} />
          <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>{t('manager.announcements.new')}</AppText>
        </Pressable>
      </View>

      {list.error || actionError ? <Banner title={t('manager.announcements.error')} /> : null}
      {list.data === undefined && list.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {list.data && list.data.length === 0 ? <EmptyState message={t('manager.announcements.empty')} icon={BellIcon} /> : null}

      {list.data && list.data.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {list.data.map((a) => {
            const tint = tints[a.kind];
            const expired = isExpired(a, now);
            const Icon = tint.icon;
            return (
              <View
                key={a.id}
                style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 4, borderLeftColor: tint.color, opacity: expired ? 0.55 : 1 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon color={tint.color} size={15} />
                    <AppText style={{ color: tint.color, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(KIND_KEY[a.kind])}</AppText>
                  </View>
                  <AppText style={{ fontWeight: '800', fontSize: 16 }}>{a.title}</AppText>
                  {a.body ? (
                    <AppText muted style={{ fontSize: 13.5, lineHeight: 19 }}>
                      {a.body}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" muted>
                    {t('manager.announcements.published', { date: dateLabel(a.createdAt) })} ·{' '}
                    {expired ? t('manager.announcements.expired') : a.expiresAt ? t('manager.announcements.expires', { date: dateLabel(a.expiresAt) }) : t('manager.announcements.noExpiry')}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => setConfirmDelete(a)}
                  accessibilityRole="button"
                  accessibilityLabel={t('manager.announcements.delete')}
                  style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
                  <XIcon color={theme.textMuted} size={18} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <AppText muted variant="caption" style={{ textAlign: 'center' }}>
        {t('manager.announcements.note')}
      </AppText>

      <NewAnnouncementModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          list.reload();
        }}
      />

      <ConfirmDialog
        visible={confirmDelete !== null}
        destructive
        title={t('manager.announcements.deleteConfirm.title')}
        message={t('manager.announcements.deleteConfirm.body')}
        confirmLabel={t('manager.announcements.delete')}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

function NewAnnouncementModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const tints = useKindTint();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AnnouncementKind>('info');
  const [days, setDays] = useState<number | null>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function close(): void {
    setTitle('');
    setBody('');
    setKind('info');
    setDays(1);
    setError(false);
    onClose();
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim() || null,
        kind,
        expiresAt: days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString(),
      });
      setTitle('');
      setBody('');
      setKind('info');
      setDays(1);
      onCreated();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { minHeight: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontSize: 15 } as const;
  const pill = (selected: boolean, color: string) =>
    ({ minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? color : theme.border, backgroundColor: selected ? theme.surfaceAlt : 'transparent' }) as const;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 480, maxHeight: '92%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="display" style={{ fontSize: 22 }}>
              {t('manager.announcements.new')}
            </AppText>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('manager.announcements.field.kind')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(['info', 'warning', 'closure'] as const).map((k) => {
                  const Icon = tints[k].icon;
                  const selected = kind === k;
                  return (
                    <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected }} style={pill(selected, tints[k].color)}>
                      <Icon color={tints[k].color} size={15} />
                      <AppText style={{ fontWeight: '700', fontSize: 13.5 }}>{t(KIND_KEY[k])}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('manager.announcements.field.title')}
              </AppText>
              <TextInput value={title} onChangeText={setTitle} placeholder={t('manager.announcements.titlePlaceholder')} placeholderTextColor={theme.textMuted} maxLength={80} autoComplete="off" textContentType="none" style={inputStyle} />
            </View>

            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('manager.announcements.field.body')}
              </AppText>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={t('manager.announcements.bodyPlaceholder')}
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={400}
                autoComplete="off"
                textContentType="none"
                style={{ ...inputStyle, minHeight: 88, paddingTop: spacing.sm, textAlignVertical: 'top' }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('manager.announcements.field.duration')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {DURATIONS.map((d) => {
                  const selected = days === d.days;
                  return (
                    <Pressable key={d.key} onPress={() => setDays(d.days)} accessibilityRole="button" accessibilityState={{ selected }} style={pill(selected, theme.primary)}>
                      <AppText style={{ fontWeight: '700', fontSize: 13.5, color: selected ? theme.primary : theme.text }}>{t(d.key)}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? <Banner title={t('manager.announcements.error')} /> : null}
          </ScrollView>

          <Button label={t('manager.announcements.send')} onPress={() => void submit()} disabled={busy || title.trim().length === 0} />
        </View>
      </View>
    </Modal>
  );
}

import { useState, type ReactElement, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { decorativeA11yProps } from '@/lib/a11y';
import { formatRelativeTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { AppText } from './AppText';
import { ROLE_TOP_BAR_HEIGHT } from './RoleTopBar';
import { Segmented } from './Segmented';

type IconType = (p: { color: string; size: number }) => ReactElement;

export interface NotificationListItem {
  id: string;
  icon: IconType;
  tint: string;
  title: string;
  description?: string;
  /** RFC 3339 — formatted with `formatRelativeTime`, same as everywhere else in the app. */
  createdAt: string;
  read: boolean;
  onPress?: () => void;
}

/**
 * The Manager/Coach notification panel: a title row with "Segna tutte lette", All/Unread tabs, and
 * a scrollable list of items (icon circle, bold title, description, relative time, an unread dot)
 * — replaces the old plain `ActionSheet` action-list rendering with something that actually shows
 * *what* arrived, not just a count and a shortcut button.
 *
 * In sidebar mode (wide web), this opens as a small dropdown anchored right under the bell in
 * `RoleTopBar` (top-right), not a full-width sheet sliding up from the bottom — the bell itself
 * never moves (it's fixed there, see `RoleTopBar`), so the panel it opens should stay next to it
 * instead of taking over the screen. On a narrow window or native, it's the usual bottom sheet
 * (same shell as `ActionSheet`), since that's the natural mobile pattern and there's no fixed bell
 * position to anchor to there.
 */
export function NotificationsSheet({
  visible,
  onClose,
  items,
  onMarkAllRead,
  emptyLabel,
}: {
  visible: boolean;
  onClose: () => void;
  items: NotificationListItem[];
  onMarkAllRead?: () => void;
  emptyLabel: string;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const isSidebar = useSidebarMode();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = items.filter((i) => !i.read).length;
  const visibleItems = filter === 'unread' ? items.filter((i) => !i.read) : items;

  return (
    <Modal visible={visible} transparent animationType={isSidebar ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
          style={
            isSidebar
              ? {
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  alignItems: 'flex-end',
                  paddingTop: insets.top + ROLE_TOP_BAR_HEIGHT + spacing.lg + 8,
                  paddingRight: spacing.lg,
                }
              : { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', padding: 10, paddingBottom: 10 + insets.bottom }
          }>
          <Pressable
            accessible={false}
            accessibilityViewIsModal
            style={
              isSidebar
                ? {
                    width: 380,
                    maxWidth: '100%',
                    backgroundColor: theme.surface,
                    borderRadius: radius.sheet,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 18,
                    gap: spacing.md,
                  }
                : {
                    width: '100%',
                    maxWidth: 520,
                    alignSelf: 'center',
                    backgroundColor: theme.surface,
                    borderRadius: radius.sheet,
                    borderWidth: 1,
                    borderColor: theme.border,
                    paddingTop: 14,
                    paddingHorizontal: 22,
                    paddingBottom: 22,
                    gap: spacing.md,
                  }
            }>
            {!isSidebar ? (
              <View
                {...decorativeA11yProps}
                style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: theme.borderStrong, alignSelf: 'center', marginBottom: 2 }}
              />
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText accessibilityRole="header" style={{ fontFamily: fontFamily.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.04 * 20 }}>
                {t('notifications.title')}
              </AppText>
              {onMarkAllRead && unreadCount > 0 ? (
                <Pressable onPress={onMarkAllRead} accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead')}>
                  <AppText color={theme.primary} style={{ fontSize: 13, fontWeight: '700' }}>
                    {t('notifications.markAllRead')}
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            <Segmented<'all' | 'unread'>
              label={t('notifications.title')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('notifications.filter.all') },
                { value: 'unread', label: t('notifications.filter.unread', { n: unreadCount }) },
              ]}
              trackColor={theme.background}
            />

            {visibleItems.length === 0 ? (
              <AppText variant="caption" muted style={{ paddingVertical: spacing.lg, textAlign: 'center' }}>
                {emptyLabel}
              </AppText>
            ) : (
              <ScrollView style={{ maxHeight: isSidebar ? 360 : 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 2 }}>
                  {visibleItems.map((item) => (
                    <NotificationRow key={item.id} item={item} lang={lang} onClose={onClose} />
                  ))}
                </View>
              </ScrollView>
            )}

            {!isSidebar ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: theme.surfaceAlt }}>
                <AppText style={{ fontWeight: '700', fontSize: 14 }}>{t('common.close')}</AppText>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function NotificationRow({ item, lang, onClose }: { item: NotificationListItem; lang: 'it' | 'en'; onClose: () => void }) {
  const theme = useTheme();
  const Icon = item.icon;
  const content: ReactNode = (
    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: 4 }}>
      <View {...decorativeA11yProps} style={{ width: 8, alignItems: 'center', paddingTop: 8 }}>
        {!item.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }} /> : null}
      </View>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${item.tint}1F` }}>
        <Icon color={item.tint} size={16} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: 14, fontWeight: '700', lineHeight: 19 }}>{item.title}</AppText>
        {item.description ? (
          <AppText muted numberOfLines={3} style={{ fontSize: 13, lineHeight: 18 }}>
            {item.description}
          </AppText>
        ) : null}
        <AppText variant="caption" muted style={{ fontSize: 11 }}>
          {formatRelativeTime(lang, item.createdAt)}
        </AppText>
      </View>
    </View>
  );
  if (!item.onPress) return content;
  return (
    <Pressable
      onPress={() => {
        onClose();
        item.onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => ({ borderRadius: radius.md, backgroundColor: pressed ? theme.surfaceAlt : 'transparent' })}>
      {content}
    </Pressable>
  );
}

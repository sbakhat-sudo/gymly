import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { decorativeA11yProps } from '@/lib/a11y';
import type { GoalPopupMessage } from '@/lib/domain/weekly-goal';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

const COPY = {
  progress: { title: 'home.goal.progress.title' as const, body: 'home.goal.progress.body' as const },
  reached: { title: 'home.goal.reached.title' as const, body: 'home.goal.reached.body' as const },
  missed: { title: 'home.goal.missed.title' as const, body: 'home.goal.missed.body' as const },
} as const;

/**
 * Same bottom-sheet shell as `ConfirmDialog`, simplified to one dismiss action — this is a
 * motivational nudge, never a decision with two real outcomes. "Chiudibile con un tap, senza
 * bloccare la navigazione" (spec): tapping the backdrop or the button both just close it, nothing
 * else on screen is blocked while it's up.
 */
export function GoalMessageDialog({ message, onClose }: { message: GoalPopupMessage; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const copy = COPY[message.kind];
  const body = message.kind === 'progress' ? t(copy.body, { n: message.remaining }) : t(copy.body);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        accessibilityLabel={t('home.goal.close')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', padding: 10, paddingBottom: 10 + insets.bottom }}>
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          style={{
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
          }}>
          <View
            {...decorativeA11yProps}
            style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: theme.borderStrong, alignSelf: 'center', marginBottom: 6 }}
          />
          <AppText accessibilityRole="header" style={{ fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.04 * 22 }}>
            {t(copy.title)}
          </AppText>
          <AppText muted style={{ fontSize: 14, lineHeight: 21 }}>
            {body}
          </AppText>
          <Button label={t('home.goal.close')} onPress={onClose} variant="invert" style={{ minHeight: 56, marginTop: spacing.sm }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

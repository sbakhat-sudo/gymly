import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { decorativeA11yProps } from '@/lib/a11y';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Defaults to "Annulla"/"Cancel"; override for a dialog whose two options are both explicit answers (e.g. "No, sono uscito"). */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

/**
 * Aurora bottom sheet: slides up from the bottom rather than the earlier centred card, so it
 * behaves the same on iOS, Android and web (`Alert.alert` is a no-op on web) and can be labelled
 * for screen readers. The non-destructive action is the bold "text on background" pill (Aurora's
 * house affirmative style); the destructive one stays `danger`.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive = false }: ConfirmDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
          padding: 10,
          paddingBottom: 10 + insets.bottom,
        }}>
        {/* Inner pressable swallows taps so touching the sheet does not dismiss it. */}
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
            {title}
          </AppText>
          <AppText muted style={{ fontSize: 14, lineHeight: 21 }}>
            {message}
          </AppText>
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Button label={confirmLabel} onPress={onConfirm} variant={destructive ? 'danger' : 'invert'} style={{ minHeight: 56 }} />
            <Button label={cancelLabel ?? t('common.cancel')} onPress={onCancel} variant="secondary" style={{ minHeight: 56 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

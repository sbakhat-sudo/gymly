import { Modal, Pressable, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

/**
 * Explicit confirmation, drawn by the app itself so it behaves the same on iOS, Android and web
 * (`Alert.alert` is a no-op on web) and can be labelled for screen readers.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, destructive = false }: ConfirmDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        {/* Inner pressable swallows taps so touching the card does not dismiss it. */}
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            padding: spacing.xl,
            gap: spacing.lg,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          <AppText muted>{message}</AppText>
          <View style={{ gap: spacing.sm }}>
            <Button label={confirmLabel} onPress={onConfirm} variant={destructive ? 'danger' : 'primary'} />
            <Button label={t('common.cancel')} onPress={onCancel} variant="secondary" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

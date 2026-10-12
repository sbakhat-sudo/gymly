import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { decorativeA11yProps } from '@/lib/a11y';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
  /** Extra content below the title, above the actions — e.g. a rename text field. */
  children?: ReactNode;
}

/** Same bottom-sheet shell as ConfirmDialog, with a list of actions instead of a fixed confirm/cancel pair. */
export function ActionSheet({ visible, title, subtitle, actions, onClose, children }: ActionSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Without this, the keyboard (e.g. the reassign-manager search field) just covers the sheet
          instead of pushing it up — Modal's content sits in its own native window and does not
          automatically resize for the keyboard the way a normal screen does. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'flex-end',
            padding: 10,
            paddingBottom: 10 + insets.bottom,
          }}>
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
              gap: spacing.sm,
            }}>
            <View
              {...decorativeA11yProps}
              style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: theme.borderStrong, alignSelf: 'center', marginBottom: 6 }}
            />
            <AppText accessibilityRole="header" style={{ fontFamily: fontFamily.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.04 * 20 }}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
                {subtitle}
              </AppText>
            ) : null}
            {children}
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {actions.map((a) => (
                <Button key={a.label} label={a.label} onPress={a.onPress} disabled={a.disabled} variant={a.destructive ? 'danger' : 'secondary'} style={{ minHeight: 52 }} />
              ))}
              <Button label={t('common.cancel')} onPress={onClose} variant="secondary" style={{ minHeight: 52 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

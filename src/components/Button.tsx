import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** Longer spoken label when the visible one is short ("Riscatta" → "Riscatta Pass ospite per 120 punti"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, accessibilityLabel, style }: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    danger: { bg: theme.danger, fg: theme.onDanger, border: theme.danger },
    secondary: { bg: 'transparent', fg: theme.text, border: theme.border },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TAP,
          minWidth: MIN_TAP,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          borderWidth: 1.5,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      <AppText color={palette.fg} style={{ fontWeight: '600', textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

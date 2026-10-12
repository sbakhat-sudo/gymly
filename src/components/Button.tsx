import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'secondary' | 'danger' | 'dangerSoft' | 'invert';
  disabled?: boolean;
  /** Longer spoken label when the visible one is short ("Riscatta" → "Riscatta Pass ospite per 120 punti"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, accessibilityLabel, style }: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary },
    accent: { bg: theme.accent, fg: theme.onAccent },
    danger: { bg: theme.danger, fg: theme.onDanger },
    /** Destructive entry point that is not the final confirmation (it opens one): the red "soft" pair, already AA-tested. */
    dangerSoft: { bg: theme.band.red.soft, fg: theme.band.red.onSoft },
    secondary: { bg: theme.surfaceAlt, fg: theme.text },
    /** Aurora's bold "text on background" affirmative action (bottom sheets) — same pairing as body text, just reversed (already ≥4.5:1). */
    invert: { bg: theme.text, fg: theme.background },
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
          minHeight: 50,
          minWidth: MIN_TAP,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      <AppText color={palette.fg} style={{ fontWeight: '700', textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

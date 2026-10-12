import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';

interface GlassCardProps extends ViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Aurora "frosted glass" surface: a translucent fill + hairline border (no real blur —
 * `expo-blur` is not in this project's allowed, Expo-Go-only dependency set). Used over an `Orb`
 * or another textured background; `Card` (opaque `surface`) is still the default elsewhere.
 */
export function GlassCard({ children, style, ...rest }: GlassCardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          borderRadius: radius.xl,
          padding: 18,
          gap: spacing.md,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

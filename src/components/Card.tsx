import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface CardProps {
  children: ReactNode;
  /** Dashed border: used for anything that is NOT a live measurement (forecast, stale, unavailable). */
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, dashed = false, style }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: radius.lg,
          borderWidth: dashed ? 1.5 : 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderColor: theme.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="title" accessibilityRole="header">
      {children}
    </AppText>
  );
}

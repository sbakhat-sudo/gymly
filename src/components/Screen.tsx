import type { ReactNode } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/lib/theme';

interface ScreenProps {
  children: ReactNode;
  /** Pull-to-refresh (a manual, member-initiated refresh: nothing polls in the background). */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Themed, safe-area-aware scrolling page used by every tab. */
export function Screen({ children, onRefresh, refreshing = false }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
        // Keeps the content readable on wide windows (tablet / web preview).
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} /> : undefined
      }>
      {children}
    </ScrollView>
  );
}

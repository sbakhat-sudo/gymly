import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface BoundaryProps {
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    // Only the error's class name is logged, in development only (see lib/logger).
    logger.error('ui.render_failed', error);
  }

  private reset = (): void => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** Global safety net: an unexpected render error shows a calm, non-technical screen instead of crashing. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <Boundary fallback={(reset) => <ErrorScreen onRetry={reset} />}>{children}</Boundary>;
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
        backgroundColor: theme.background,
      }}>
      <AppText variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {t('error.generic.title')}
      </AppText>
      <AppText muted style={{ textAlign: 'center' }}>
        {t('error.generic.body')}
      </AppText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        style={{
          minHeight: MIN_TAP,
          minWidth: MIN_TAP * 2,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.primary,
        }}>
        <AppText color={theme.onPrimary} style={{ fontWeight: '600' }}>
          {t('common.retry')}
        </AppText>
      </Pressable>
    </View>
  );
}

import type { ReactElement } from 'react';
import { View } from 'react-native';

import { decorativeA11yProps } from '@/lib/a11y';
import { radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { InboxIcon } from './icons';

type IconComponent = (p: { color: string; size?: number }) => ReactElement;

/** "Nothing here yet" for a list or page — a calm centred card with an icon, instead of the full-width
 * info bar `Banner` draws (that one stays for real notices: offline, errors, hints). The icon is
 * decorative; the sentence carries the meaning. */
export function EmptyState({ message, icon: Icon = InboxIcon }: { message: string; icon?: IconComponent }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={message}
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.card,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.border,
      }}>
      <View {...decorativeA11yProps} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={theme.textMuted} size={24} />
      </View>
      <AppText muted style={{ textAlign: 'center', maxWidth: 420 }}>
        {message}
      </AppText>
    </View>
  );
}

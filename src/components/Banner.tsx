import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { InfoIcon } from './icons';

/** Neutral inline notice (offline, closed, hints). Uses icon + text, never colour alone. */
export function Banner({ title, message }: { title?: string; message?: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={[title, message].filter(Boolean).join('. ')}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.border,
      }}>
      <InfoIcon color={theme.text} size={22} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <AppText style={{ fontWeight: '700' }}>{title}</AppText> : null}
        {message ? <AppText muted>{message}</AppText> : null}
      </View>
    </View>
  );
}

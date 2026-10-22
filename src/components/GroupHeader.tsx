import { View } from 'react-native';

import { spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/** Small caps eyebrow with its own icon — every group/section pairs one, so a section is never
 * identified by its name alone. Shared across every role (Admin/Manager/Coach/Client). */
export function GroupHeader({ icon: Icon, label }: { icon: IconType; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
      <Icon color={theme.textMuted} size={14} />
      <AppText muted accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
        {label}
      </AppText>
    </View>
  );
}

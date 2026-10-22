import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { AppText, type TextVariant } from './AppText';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/**
 * A screen's top title, paired with the same icon its own tab already shows — so a section is never
 * identified by its name alone, consistently across every role (Admin/Manager/Coach/Client). Shared
 * instead of redefined per screen, since the icon+circle treatment is identical everywhere.
 * `variant`/`circleSize` default to the one shared scale (`display`, 32px) every role's own section
 * title uses. `fontSize` scales the title text down from that default (same weight/font family,
 * `variant` still controls those) without touching the Manager/Coach/Admin screens that don't pass
 * it — the Client app tried the full 46px `display` size and it read as too large on an actual
 * phone, confirmed live; its own screens pass a smaller `fontSize` (and a matching smaller
 * `circleSize`) instead of a different named variant, so the font/weight still matches everyone
 * else's section titles exactly, just scaled.
 */
export function PageTitle({
  icon: Icon,
  label,
  variant = 'display',
  circleSize = 32,
  fontSize,
}: {
  icon: IconType;
  label: string;
  variant?: TextVariant;
  circleSize?: number;
  fontSize?: number;
}) {
  const theme = useTheme();
  const sizeOverride = fontSize ? { fontSize, lineHeight: Math.round(fontSize * 1.15), letterSpacing: fontSize * -0.05 } : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: circleSize >= 32 ? 10 : 8 }}>
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${theme.primary}22`,
        }}>
        <Icon color={theme.primary} size={Math.round(circleSize * 0.53)} />
      </View>
      <AppText variant={variant} accessibilityRole="header" style={[{ flexShrink: 1 }, sizeOverride]}>
        {label}
      </AppText>
    </View>
  );
}

import { Platform, View, type ViewStyle } from 'react-native';

import { formatTodayLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { CalendarIcon } from './icons';

/**
 * Today's actual date — always today, never anything else, not tappable. Brand-orange `accent`
 * fill so it reads as a clear "you are here" marker, distinct from `DateBadge` (the neutral,
 * clickable one in each list's own filter row, which the Manager/Coach *can* change to browse a
 * different day/week). Fixed in `RoleTopBar`, deliberately not wired to `useSelectedDate()` at
 * all — this one has exactly one job, telling you what today is, regardless of which day a list
 * elsewhere on the same screen happens to be filtered to.
 */
export function TodayBadge() {
  const { lang } = useI18n();
  const theme = useTheme();
  const label = formatTodayLabel(lang);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          height: 44,
          paddingHorizontal: 16,
          borderRadius: radius.pill,
          backgroundColor: theme.accent,
        },
        Platform.select<ViewStyle>({
          web: { boxShadow: '0 6px 18px -6px rgba(0,0,0,0.4)' } as ViewStyle,
          android: { elevation: 4 },
          default: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
        }),
      ]}>
      <CalendarIcon color={theme.onAccent} size={16} strokeWidth={2.4} />
      <AppText color={theme.onAccent} numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', letterSpacing: -0.2 }}>
        {label}
      </AppText>
    </View>
  );
}

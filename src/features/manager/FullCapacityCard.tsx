import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { UsersIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

/**
 * Shown on "La situazione" while the gym is over its full-capacity threshold: a soft red card with a coloured edge, an
 * icon in a circle, a short bold title and one line on what it means — icon and words, never colour alone. Replaces the
 * plain grey banner.
 */
export function FullCapacityCard() {
  const { t } = useI18n();
  const theme = useTheme();
  const red = theme.band.red;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${t('manager.situation.full.title')}. ${t('manager.situation.full.detail')}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: red.soft, borderLeftWidth: 5, borderLeftColor: red.solid }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
        <UsersIcon color={red.solid} size={22} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color={red.onSoft} style={{ fontWeight: '800', fontSize: 16 }}>
          {t('manager.situation.full.title')}
        </AppText>
        <AppText color={red.onSoft} style={{ fontSize: 13.5, lineHeight: 19, opacity: 0.9 }}>
          {t('manager.situation.full.detail')}
        </AppText>
      </View>
    </View>
  );
}

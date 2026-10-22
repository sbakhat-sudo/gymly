import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

import { AppText } from './AppText';
import { InfoIcon } from './icons';

/** Big, impossible-to-miss notice for a screen whose data is made up (e.g. `AdminPagamentoScreen`),
 * shown only while `DEMO_MODE` is on. Icon + bold text + the amber band colour together — never
 * colour alone, same rule as everywhere else in this app. */
export function DemoModeBanner() {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: theme.band.amber.solid,
      }}>
      <InfoIcon color={theme.band.amber.onSolid} size={22} />
      <AppText color={theme.band.amber.onSolid} numberOfLines={2} style={{ fontWeight: '800', flex: 1, fontSize: 14 }}>
        {t('demoMode.banner')}
      </AppText>
    </View>
  );
}

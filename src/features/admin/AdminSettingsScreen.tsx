import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { ClockIcon, CreditCardIcon, EyeIcon, SlidersIcon } from '@/components/icons';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PreferencesGroup } from '@/components/settings/PreferencesGroup';
import { ProfileHero } from '@/components/settings/ProfileHero';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsKit';
import { ActivityCard } from '@/features/activity/ActivityCard';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/lib/theme';

export function AdminSettingsScreen() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={SlidersIcon} label={t('settings.title')} />
      </View>

      <ProfileHero />

      {/* Grouped by purpose (platform config vs. security/logs) — each line says what it opens. */}
      <SettingsGroup title={t('admin.settings.platform')}>
        <SettingsRow icon={CreditCardIcon} label={t('admin.billing.title')} onPress={() => router.push('/pagamento')} />
      </SettingsGroup>

      <SettingsGroup title={t('admin.settings.security')}>
        <SettingsRow icon={EyeIcon} label={t('admin.gpsAudit.title')} onPress={() => router.push('/audit-gps')} />
        <SettingsRow icon={ClockIcon} label={t('admin.actionsLog.fullTitle')} onPress={() => router.push('/azioni-admin')} />
      </SettingsGroup>

      <ActivityCard roles={['owner', 'coach', 'client']} />

      <PreferencesGroup withTheme />
      <ProfileSection />
      <AccountSection />
    </Screen>
  );
}

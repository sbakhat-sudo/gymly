import { View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { SlidersIcon } from '@/components/icons';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PreferencesGroup } from '@/components/settings/PreferencesGroup';
import { ProfileHero } from '@/components/settings/ProfileHero';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/lib/theme';

export function CoachSettingsScreen() {
  const { t } = useI18n();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={SlidersIcon} label={t('settings.title')} />
      </View>

      <ProfileHero />
      <PreferencesGroup />
      <ProfileSection includeBirthYear />
      <AccountSection />
    </Screen>
  );
}

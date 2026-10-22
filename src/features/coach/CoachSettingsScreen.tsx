import { View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { Card, SectionLabel } from '@/components/Card';
import { SlidersIcon } from '@/components/icons';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { SignOutButton } from '@/components/SignOutButton';
import { useAppState } from '@/lib/app-state';
import { useI18n, type Lang } from '@/lib/i18n';
import { spacing } from '@/lib/theme';

export function CoachSettingsScreen() {
  const { t, lang } = useI18n();
  const { setLang } = useAppState();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <ScreenHeader icon={SlidersIcon} label={t('settings.title')} />
        <SignOutButton />
      </View>

      <Card>
        <SectionLabel>{t('settings.language')}</SectionLabel>
        <Segmented<Lang>
          label={t('settings.language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'it', label: t('settings.lang.it') },
            { value: 'en', label: t('settings.lang.en') },
          ]}
        />
      </Card>

      <ProfileSection includeBirthYear />

      <AccountSection />
    </Screen>
  );
}

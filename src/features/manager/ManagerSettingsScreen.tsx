import { View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Card, SectionLabel } from '@/components/Card';
import { SlidersIcon } from '@/components/icons';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SignOutButton } from '@/components/SignOutButton';
import { useAppState } from '@/lib/app-state';
import { useI18n, type Lang } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { fontFamily, spacing } from '@/lib/theme';

import { ManagerMessagesSection } from './ManagerMessagesSection';
import { ManagerNotifications } from './ManagerNotifications';

export function ManagerSettingsScreen() {
  const { t, lang } = useI18n();
  const { setLang } = useAppState();
  // This screen's own header is a plain text title (no icon) — kept as-is below for narrow/native.
  // Sidebar mode's fixed `RoleTopBar` still needs a title to show while this tab is active, so it
  // registers one with the same icon its sidebar tab uses.
  usePageHeader(SlidersIcon, t('settings.title'));

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="display" style={{ fontFamily: fontFamily.displaySemi, fontSize: 24, lineHeight: 29, letterSpacing: 24 * -0.04 }}>
            {t('settings.title')}
          </AppText>
          <ManagerNotifications />
        </View>
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

      <ManagerMessagesSection />

      <ProfileSection />

      <AccountSection />
    </Screen>
  );
}

import { View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { SlidersIcon } from '@/components/icons';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { PreferencesGroup } from '@/components/settings/PreferencesGroup';
import { ProfileHero } from '@/components/settings/ProfileHero';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { fontFamily, spacing } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { ManagerMessagesSection } from './ManagerMessagesSection';
import { ManagerNotifications } from './ManagerNotifications';

export function ManagerSettingsScreen() {
  const { t } = useI18n();
  // This screen's own header is a plain text title (no icon) — kept as-is below for narrow/native.
  // Sidebar mode's fixed `RoleTopBar` still needs a title to show while this tab is active, so it
  // registers one with the same icon its sidebar tab uses.
  usePageHeader(SlidersIcon, t('settings.title'));
  const isSidebar = useSidebarMode();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {!isSidebar ? (
          <AppText variant="display" style={{ fontFamily: fontFamily.displaySemi, fontSize: 24, lineHeight: 29, letterSpacing: 24 * -0.04 }}>
            {t('settings.title')}
          </AppText>
        ) : null}
        <ManagerNotifications />
      </View>

      <ProfileHero />
      <PreferencesGroup />
      <ManagerMessagesSection />
      <ProfileSection />
      <AccountSection />
    </Screen>
  );
}

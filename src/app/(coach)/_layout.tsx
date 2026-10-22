import { Tabs } from 'expo-router/js-tabs';

import { PillTabBar } from '@/components/PillTabBar';
import { ClockIcon, LogInIcon, SlidersIcon, StarFilledIcon } from '@/components/icons';
import { RoleTopBar } from '@/components/RoleTopBar';
import { CoachNotifications } from '@/features/coach/CoachNotifications';
import { useI18n } from '@/lib/i18n';
import { PageHeaderProvider } from '@/lib/page-header-context';
import { SelectedDateProvider } from '@/lib/selected-date-context';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

export default function CoachLayout() {
  const { t } = useI18n();
  const isSidebar = useSidebarMode();

  return (
    <SidebarInsetProvider width={isSidebar ? SIDEBAR_WIDTH : 0}>
      <PageHeaderProvider>
        <SelectedDateProvider>
          <Tabs
            // A render function, not the component itself — see FloatingTabBar.tsx for why.
            tabBar={(props) => <PillTabBar {...props} />}
            screenOptions={{ headerShown: false }}>
            <Tabs.Screen
              name="index"
              options={{
                title: t('tab.coach.home'),
                tabBarAccessibilityLabel: t('tab.coach.home'),
                tabBarIcon: ({ color, size }) => <LogInIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="ore"
              options={{
                title: t('tab.coach.hours'),
                tabBarAccessibilityLabel: t('tab.coach.hours'),
                tabBarIcon: ({ color, size }) => <ClockIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="feedback"
              options={{
                title: t('tab.coach.feedback'),
                tabBarAccessibilityLabel: t('tab.coach.feedback'),
                tabBarIcon: ({ color, size }) => <StarFilledIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="impostazioni"
              options={{
                title: t('tab.settings'),
                tabBarAccessibilityLabel: t('tab.settings'),
                tabBarIcon: ({ color, size }) => <SlidersIcon color={color} size={size} />,
              }}
            />
          </Tabs>
          {isSidebar ? (
            <RoleTopBar>
              <CoachNotifications hideInSidebarMode={false} />
            </RoleTopBar>
          ) : null}
        </SelectedDateProvider>
      </PageHeaderProvider>
    </SidebarInsetProvider>
  );
}

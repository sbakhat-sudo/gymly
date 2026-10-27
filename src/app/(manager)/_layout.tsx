import { Tabs } from 'expo-router/js-tabs';

import { AlertTriangleIcon, BellIcon, ClockIcon, CreditCardIcon, HomeIcon, PulseIcon, SlidersIcon, StarFilledIcon, UsersIcon } from '@/components/icons';
import { PillTabBar } from '@/components/PillTabBar';
import { RoleTopBar } from '@/components/RoleTopBar';
import { ManagerNotifications } from '@/features/manager/ManagerNotifications';
import { useI18n } from '@/lib/i18n';
import { PageHeaderProvider } from '@/lib/page-header-context';
import { SelectedDateProvider } from '@/lib/selected-date-context';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

export default function ManagerLayout() {
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
                title: t('tab.manager.situation'),
                tabBarAccessibilityLabel: t('tab.manager.situation'),
                tabBarIcon: ({ color, size }) => <PulseIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="apertura"
              options={{
                title: t('tab.manager.opening'),
                tabBarAccessibilityLabel: t('tab.manager.opening'),
                tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="persone"
              options={{
                title: t('tab.manager.people'),
                tabBarAccessibilityLabel: t('tab.manager.people'),
                tabBarIcon: ({ color, size }) => <UsersIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="ore"
              options={{
                title: t('tab.manager.workHours'),
                tabBarAccessibilityLabel: t('tab.manager.workHours'),
                tabBarIcon: ({ color, size }) => <ClockIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="feedback"
              options={{
                title: t('tab.manager.feedback'),
                tabBarAccessibilityLabel: t('tab.manager.feedback'),
                tabBarIcon: ({ color, size }) => <StarFilledIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="issues"
              options={{
                title: t('tab.manager.issues'),
                tabBarAccessibilityLabel: t('tab.manager.issues'),
                tabBarIcon: ({ color, size }) => <AlertTriangleIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="abbonamenti"
              options={{
                title: t('tab.manager.subscriptions'),
                tabBarAccessibilityLabel: t('tab.manager.subscriptions'),
                tabBarIcon: ({ color, size }) => <CreditCardIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="avvisi"
              options={{
                title: t('tab.manager.announcements'),
                tabBarAccessibilityLabel: t('tab.manager.announcements'),
                tabBarIcon: ({ color, size }) => <BellIcon color={color} size={size} />,
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
              <ManagerNotifications hideInSidebarMode={false} />
            </RoleTopBar>
          ) : null}
        </SelectedDateProvider>
      </PageHeaderProvider>
    </SidebarInsetProvider>
  );
}

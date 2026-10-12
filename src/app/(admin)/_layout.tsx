import { Tabs } from 'expo-router/js-tabs';

import { DumbbellIcon, PulseIcon, SlidersIcon, UsersIcon } from '@/components/icons';
import { PillTabBar } from '@/components/PillTabBar';
import { useI18n } from '@/lib/i18n';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

export default function AdminLayout() {
  const { t } = useI18n();
  const isSidebar = useSidebarMode();

  return (
    <SidebarInsetProvider width={isSidebar ? SIDEBAR_WIDTH : 0}>
      <Tabs
        // A render function, not the component itself — see FloatingTabBar.tsx for why.
        tabBar={(props) => <PillTabBar {...props} />}
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.admin.dashboard'),
            tabBarAccessibilityLabel: t('tab.admin.dashboard'),
            tabBarIcon: ({ color, size }) => <PulseIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="palestre"
          options={{
            title: t('tab.admin.sites'),
            tabBarAccessibilityLabel: t('tab.admin.sites'),
            tabBarIcon: ({ color, size }) => <DumbbellIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="manager"
          options={{
            title: t('tab.admin.managers'),
            tabBarAccessibilityLabel: t('tab.admin.managers'),
            tabBarIcon: ({ color, size }) => <UsersIcon color={color} size={size} />,
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
    </SidebarInsetProvider>
  );
}

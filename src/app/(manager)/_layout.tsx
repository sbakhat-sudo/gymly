import { Tabs } from 'expo-router/js-tabs';

import { HomeIcon, InboxIcon, PulseIcon, SlidersIcon, UsersIcon } from '@/components/icons';
import { PillTabBar } from '@/components/PillTabBar';
import { useI18n } from '@/lib/i18n';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

export default function ManagerLayout() {
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
            title: t('tab.manager.situation'),
            tabBarAccessibilityLabel: t('tab.manager.situation'),
            tabBarIcon: ({ color, size }) => <PulseIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="richieste"
          options={{
            title: t('tab.manager.requests'),
            tabBarAccessibilityLabel: t('tab.manager.requests'),
            tabBarIcon: ({ color, size }) => <InboxIcon color={color} size={size} />,
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

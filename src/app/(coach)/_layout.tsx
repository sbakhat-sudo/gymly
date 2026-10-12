import { Tabs } from 'expo-router/js-tabs';

import { PillTabBar } from '@/components/PillTabBar';
import { LogInIcon, SlidersIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

export default function CoachLayout() {
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
            title: t('tab.coach.home'),
            tabBarAccessibilityLabel: t('tab.coach.home'),
            tabBarIcon: ({ color, size }) => <LogInIcon color={color} size={size} />,
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

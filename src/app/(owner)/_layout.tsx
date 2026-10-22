import { Tabs } from 'expo-router/js-tabs';

import { PulseIcon, SlidersIcon, UsersIcon } from '@/components/icons';
import { PillTabBar } from '@/components/PillTabBar';
import { RoleTopBar } from '@/components/RoleTopBar';
import { useI18n } from '@/lib/i18n';
import { PageHeaderProvider } from '@/lib/page-header-context';
import { SelectedDateProvider } from '@/lib/selected-date-context';
import { SidebarInsetProvider } from '@/lib/sidebar-inset-context';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

/** Owner ("Titolare") — same shell as Admin (`(admin)/_layout.tsx`): Tabs + PillTabBar, RoleTopBar
 * only in sidebar mode. No "palestre" tab like Admin's — the Managers tab already covers it here,
 * since an Owner's sites are always exactly its own Managers' sites. The per-manager detail view
 * (clients/coaches/map) is an in-screen sheet inside OwnerManagersScreen, not a separate route —
 * same convention as AdminSitesScreen's per-site sheet. */
export default function OwnerLayout() {
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
                title: t('tab.owner.dashboard'),
                tabBarAccessibilityLabel: t('tab.owner.dashboard'),
                tabBarIcon: ({ color, size }) => <PulseIcon color={color} size={size} />,
              }}
            />
            <Tabs.Screen
              name="manager"
              options={{
                title: t('tab.owner.managers'),
                tabBarAccessibilityLabel: t('tab.owner.managers'),
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
          {isSidebar ? <RoleTopBar /> : null}
        </SelectedDateProvider>
      </PageHeaderProvider>
    </SidebarInsetProvider>
  );
}

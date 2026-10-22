import { Tabs } from 'expo-router/js-tabs';

import { ClockIcon, LogInIcon, PulseIcon, SlidersIcon, StarFilledIcon } from '@/components/icons';
import { FloatingTabBar } from '@/features/common/FloatingTabBar';
import { useI18n } from '@/lib/i18n';
import { SelectedDateProvider } from '@/lib/selected-date-context';

export default function TabsLayout() {
  const { t } = useI18n();

  return (
    <SelectedDateProvider>
      <Tabs
        // A render function, not the component itself: React Navigation calls `tabBar(props)` as a
        // plain function, which would run FloatingTabBar's hooks outside a component ("Invalid hook call").
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.live'),
            tabBarAccessibilityLabel: t('tab.live'),
            tabBarIcon: ({ color, size }) => <PulseIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="checkin"
          options={{
            title: t('tab.checkin'),
            tabBarAccessibilityLabel: t('tab.checkin'),
            tabBarIcon: ({ color, size }) => <LogInIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="orari"
          options={{
            title: t('tab.schedule'),
            tabBarAccessibilityLabel: t('tab.schedule'),
            tabBarIcon: ({ color, size }) => <ClockIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="feedback"
          options={{
            title: t('tab.feedback'),
            tabBarAccessibilityLabel: t('tab.feedback'),
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
    </SelectedDateProvider>
  );
}

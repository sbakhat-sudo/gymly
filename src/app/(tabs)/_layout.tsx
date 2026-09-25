import { Tabs } from 'expo-router/js-tabs';

import { ClockIcon, HomeIcon, SlidersIcon, StarIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.home'),
          tabBarAccessibilityLabel: t('tab.home'),
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
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
        name="punti"
        options={{
          title: t('tab.points'),
          tabBarAccessibilityLabel: t('tab.points'),
          tabBarIcon: ({ color, size }) => <StarIcon color={color} size={size} />,
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
  );
}

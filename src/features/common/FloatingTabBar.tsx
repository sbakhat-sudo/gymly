import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { ExitIcon, LogInIcon } from '@/components/icons';
import { useCheckinContext } from '@/features/checkin/checkin-context';
import { useLiveBand } from '@/features/home/use-live-band';
import { decorativeA11yProps } from '@/lib/a11y';
import { formatStopwatch } from '@/lib/domain/checkin';
import { useI18n } from '@/lib/i18n';
import { useCurrentSite } from '@/lib/sites-context';
import { useTheme } from '@/lib/theme';

const LEFT_TABS = ['index', 'orari'] as const;
const RIGHT_TABS = ['feedback', 'impostazioni'] as const;
const CHECKIN_ROUTE = 'checkin';
const FAB_SIZE = 76;
const BAR_HEIGHT = 68;

/** Soft coloured glow under the raised button (web box-shadow / iOS shadow / Android elevation). */
function glow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 10px 30px -4px ${color}` } as ViewStyle,
    android: { elevation: 8 },
    default: { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  });
}

/**
 * Aurora's floating pill tab bar: Live · Orari · [raised Check-in] · Punti · Impostazioni.
 * Icon-only, as in the design — every tab still carries its spoken name (accessibilityLabel).
 * Registered via the `tabBar` prop on the `(client)/_layout.tsx` navigator.
 */
export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const checkin = useCheckinContext();
  const current = useCurrentSite();
  const liveBand = useLiveBand(current.site);

  const activeRoute = state.routes[state.index];
  const checkedIn = checkin.phase !== null;

  const goTo = (routeName: string, routeKey: string): void => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (activeRoute?.name !== routeName && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const renderTab = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    const descriptor = route ? descriptors[route.key] : undefined;
    if (!route || !descriptor) return null;
    const { options } = descriptor;
    const focused = activeRoute?.key === route.key;
    const color = focused ? theme.text : theme.faint;
    return (
      <Pressable
        key={route.key}
        onPress={() => goTo(route.name, route.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {options.tabBarIcon?.({ focused, color, size: 24 })}
      </Pressable>
    );
  };

  const checkinRoute = state.routes.find((r) => r.name === CHECKIN_ROUTE);
  const fabLabel = checkedIn
    ? t('checkin.tabbar.exit.a11y')
    : (descriptors[checkinRoute?.key ?? '']?.options.tabBarAccessibilityLabel ?? t('tab.checkin'));
  // Idle: the live band's colour; neutral brand blue whenever the live band is not known.
  const fabBg = checkedIn ? theme.text : liveBand ? theme.band[liveBand].solid : theme.primary;
  const fabFg = checkedIn ? theme.background : liveBand ? theme.band[liveBand].onSolid : theme.onPrimary;

  return (
    <View
      style={{ pointerEvents: 'box-none', position: 'absolute', left: 18, right: 18, bottom: 24 + insets.bottom, height: FAB_SIZE + 16 }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: theme.tabBar,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
        }}>
        {LEFT_TABS.map(renderTab)}
        {/* Space reserved for the raised check-in button, between Orari and Punti. */}
        <View style={{ width: 78 }} {...decorativeA11yProps} />
        {RIGHT_TABS.map(renderTab)}
      </View>

      {checkinRoute ? (
        <Pressable
          onPress={() => goTo(checkinRoute.name, checkinRoute.key)}
          accessibilityRole="button"
          accessibilityLabel={fabLabel}
          style={({ pressed }) => [
            {
              position: 'absolute',
              left: '50%',
              marginLeft: -FAB_SIZE / 2,
              bottom: 16,
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_SIZE / 2,
              borderWidth: 6,
              borderColor: theme.background,
              backgroundColor: fabBg,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              opacity: pressed ? 0.9 : 1,
            },
            glow(checkedIn ? theme.textMuted : fabBg),
          ]}>
          {checkedIn ? <ExitIcon color={fabFg} size={22} strokeWidth={2.4} /> : <LogInIcon color={fabFg} size={22} strokeWidth={2.4} />}
          <AppText
            color={fabFg}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {checkedIn ? formatStopwatch(checkin.elapsedSeconds) : t('checkin.button.in')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

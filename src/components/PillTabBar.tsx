import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/auth-context';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import { SIDEBAR_WIDTH, useSidebarMode } from '@/lib/use-sidebar-mode';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { LogOutIcon } from './icons';

const BAR_HEIGHT = 68;

function glow(): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 30px -8px rgba(0,0,0,0.35)' } as ViewStyle,
    android: { elevation: 6 },
    default: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  });
}

function tooltipGlow(): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 20px -6px rgba(0,0,0,0.45)' } as ViewStyle,
    default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  });
}

/**
 * Same floating-pill idiom as the Client's FloatingTabBar, without the raised centre button (the
 * Manager and Coach have no check-in-from-the-tab-bar). Used by the Manager (5 tabs) and Coach (2
 * tabs). Must stay a function passed as `tabBar={(props) => <PillTabBar {...props} />}` —
 * expo-router's forked BottomTabView calls this prop as a bare function, so a component reference
 * breaks the Rules of Hooks (see FloatingTabBar.tsx for the same fix, hit once already).
 *
 * On wide web windows this renders as a left sidebar column instead (a bottom-of-phone pill reads
 * as mobile UI, not a desktop app) — see `useSidebarMode`.
 */
export function PillTabBar(props: BottomTabBarProps) {
  const isSidebar = useSidebarMode();
  return isSidebar ? <Sidebar {...props} /> : <Pill {...props} />;
}

function Pill({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const activeRoute = state.routes[state.index];

  const goTo = (routeName: string, routeKey: string): void => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (activeRoute?.name !== routeName && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={{ pointerEvents: 'box-none', position: 'absolute', left: 18, right: 18, bottom: 24 + insets.bottom, height: BAR_HEIGHT }}>
      <View
        style={[
          {
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: theme.tabBar,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 6,
          },
          glow(),
        ]}>
        {state.routes.map((route) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          // Expo Router's file-based Tabs auto-registers every file in the directory as a route
          // whether or not it's declared as a `<Tabs.Screen>` with tab options — an undeclared (or
          // `href: null`, which this fork doesn't actually honour for a custom tabBar) file still
          // shows up in `state.routes` with empty `options`, rendering as a blank, unlabelled tab
          // slot. A real tab always sets `tabBarIcon`, so its absence is the reliable "skip this
          // one" signal.
          if (!options.tabBarIcon) return null;
          const focused = activeRoute?.key === route.key;
          const color = focused ? theme.text : theme.faint;
          return (
            <Pressable
              key={route.key}
              onPress={() => goTo(route.name, route.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
              style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The hover name pill: fades and slides in from the icon. Opacity + transform only, so it runs
 * without touching layout (nothing else on the page moves or re-measures while it plays). */
function HoverLabel({ label, anchor }: { label: string; anchor?: { left: number; centerY: number } }) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, reduceMotion]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: anchor ? anchor.left : 66,
          top: anchor ? anchor.centerY : '50%',
          marginTop: -17,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.sm,
          backgroundColor: '#000000',
          opacity: progress,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        },
        tooltipGlow(),
      ]}>
      <AppText color="#FFFFFF" numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
        {label}
      </AppText>
    </Animated.View>
  );
}

/** One icon button in the sidebar: on hover (web only — native ignores `onHoverIn`/`onHoverOut`),
 * shows the section's name in a pill to its right (`HoverLabel`) so the column can stay icon-only
 * and slim. (It can't go to the left instead — the sidebar already sits right at the screen's own
 * left edge, nowhere near enough room for a label-width pill to fit before running off-screen.) */
function SidebarItem({
  icon,
  label,
  focused,
  danger = false,
  onPress,
  onTip,
}: {
  icon: (color: string) => ReactNode;
  label: string;
  focused: boolean;
  danger?: boolean;
  onPress: () => void;
  /** Items inside the sidebar's ScrollView can't draw their own pill — a scroll container clips
   * anything past its edge, so the label would be cut off. They report the hover instead and the
   * sidebar draws the pill outside the scroll (see `Sidebar`). */
  onTip?: (tip: { label: string; left: number; centerY: number } | null) => void;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const boxRef = useRef<View>(null);
  const color = danger ? theme.band.red.solid : focused ? theme.text : theme.faint;

  const hoverIn = (): void => {
    if (!onTip) {
      setHovered(true);
      return;
    }
    boxRef.current?.measureInWindow((x, y, w, h) => onTip({ label, left: x + w + 14, centerY: y + h / 2 }));
  };
  const hoverOut = (): void => {
    if (onTip) onTip(null);
    else setHovered(false);
  };

  return (
    <View ref={boxRef} style={{ position: 'relative' }}>
      <Pressable
        onPress={onPress}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? theme.surfaceAlt : 'transparent',
        }}>
        {icon(color)}
      </Pressable>
      {hovered ? <HoverLabel label={label} /> : null}
    </View>
  );
}

function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];
  const [tip, setTip] = useState<{ label: string; left: number; centerY: number } | null>(null);
  const profile = auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? auth.profile : null;
  const roleLabel = profile ? t(`sidebar.role.${profile.role}` as 'sidebar.role.manager' | 'sidebar.role.coach' | 'sidebar.role.admin' | 'sidebar.role.owner') : null;

  const goTo = (routeName: string, routeKey: string): void => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (activeRoute?.name !== routeName && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={{ pointerEvents: 'box-none', position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH }}>
      <View
        style={[
          {
            flex: 1,
            marginHorizontal: 10,
            marginTop: spacing.lg + insets.top,
            marginBottom: spacing.lg + insets.bottom,
            borderRadius: radius.xxl,
            backgroundColor: theme.tabBar,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            paddingVertical: spacing.xl,
            alignItems: 'center',
          },
          glow(),
        ]}>
        {/* The profile (photo + role) stays put: it sits outside the scrolling list, so scrolling the icons never moves it. */}
        {profile ? (
          <View style={{ alignItems: 'center', gap: 4, marginBottom: spacing.md }}>
            <Avatar uri={profile.avatarUrl} name={profile.fullName} size={48} />
            {roleLabel ? (
              <AppText variant="caption" muted style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 }}>
                {roleLabel}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {/* `flex: 1` + its own scroll: with enough tabs (Manager now has 8) the column can outgrow a
            short window — without this the overflow was simply clipped, hiding the last tabs and
            sign-out entirely with no way to reach them. Sign-out stays outside, always pinned. */}
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{ gap: spacing.sm, alignItems: 'center', paddingBottom: spacing.sm }}
          showsVerticalScrollIndicator={false}>
          {state.routes.map((route) => {
            const descriptor = descriptors[route.key];
            if (!descriptor) return null;
            const { options } = descriptor;
            if (!options.tabBarIcon) return null;
            const focused = activeRoute?.key === route.key;
            const label = options.tabBarAccessibilityLabel ?? options.title ?? '';
            return (
              <SidebarItem
                key={route.key}
                label={label}
                focused={focused}
                onPress={() => goTo(route.name, route.key)}
                onTip={setTip}
                icon={(color) => options.tabBarIcon?.({ focused, color, size: 24 })}
              />
            );
          })}
        </ScrollView>

        {auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? (
          <SidebarItem label={t('account.signOut')} focused={false} danger onPress={() => void auth.signOut()} icon={(color) => <LogOutIcon color={color} size={22} strokeWidth={2.2} />} />
        ) : null}
      </View>
      {tip ? <HoverLabel key={tip.label} label={tip.label} anchor={{ left: tip.left, centerY: tip.centerY }} /> : null}
    </View>
  );
}

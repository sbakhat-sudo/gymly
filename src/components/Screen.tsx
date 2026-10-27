import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { decorativeA11yProps } from '@/lib/a11y';
import { useSidebarInset } from '@/lib/sidebar-inset-context';
import { spacing, useTheme } from '@/lib/theme';

import { Orb } from './Orb';
import { ROLE_TOP_BAR_HEIGHT } from './RoleTopBar';

export interface ScreenOrb {
  color: string;
  /** Top of the glow, measured from the top of the scrolling content (below the safe area). */
  top: number;
  size: number;
}

interface ScreenProps {
  children: ReactNode;
  /** Pull-to-refresh (a manual, member-initiated refresh: nothing polls in the background). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Aurora glow behind the content, horizontally centred; it scrolls with the page. */
  orb?: ScreenOrb;
  /** Caps the content column's width on wide windows (tablet / web). Defaults to 720 (a single
   * readable column) unless the sidebar nav is showing (wide Manager/Coach/Admin web), where this
   * is a dashboard of cards/tables that should use the room it has rather than float as a capped
   * column with dead space on either side — no cap there by default (fills whatever width the
   * sidebar leaves it, on any window size). A public page meant to look like an actual website on
   * desktop web (Benvenuto) passes a value explicitly, which always wins over either default. */
  maxWidth?: number;
  /** Space reserved below the content. Defaults to ~130 to clear the floating tab bar + its raised
   * check-in button — every in-app tab sits above that bar. A pre-auth page (Benvenuto) has no tab
   * bar at all, so it passes a much smaller value instead of leaving that gap as dead space. */
  bottomPadding?: number;
}

/** Themed, safe-area-aware scrolling page used by every tab. */
export function Screen({ children, onRefresh, refreshing = false, orb, maxWidth, bottomPadding = 130 }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sidebarInset = useSidebarInset();
  const resolvedMaxWidth = maxWidth ?? (sidebarInset > 0 ? undefined : 720);
  return (
    <ScrollView
      // The sidebar inset must NOT live here: with `refreshControl`, react-native-web hands this same `style`
      // to both the RefreshControl wrapper and the inner ScrollView, so the inset was applied twice (an extra
      // sidebar-width of blank space on exactly the pages that pull to refresh). It is part of the content
      // padding below instead, which is applied once, the same way on every page.
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        // Sidebar mode (Manager/Coach/Admin web) also has a `RoleTopBar` fixed above the content —
        // extra room so scrolling content starts below it instead of underneath it.
        paddingTop: insets.top + spacing.md + (sidebarInset > 0 ? ROLE_TOP_BAR_HEIGHT + spacing.lg + spacing.md : 0),
        paddingLeft: spacing.lg + sidebarInset,
        paddingRight: spacing.lg,
        paddingBottom: bottomPadding + insets.bottom,
        gap: 14,
        // Keeps the content readable on wide windows (tablet / web preview).
        maxWidth: resolvedMaxWidth,
        width: '100%',
        alignSelf: 'center',
      }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      // On iPhone the page makes room for the keyboard by itself and scrolls the field being typed in into view, so the
      // keyboard never hides what is being written (Android already resizes the window).
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} /> : undefined
      }>
      {orb ? (
        <View
          {...decorativeA11yProps}
          style={{ pointerEvents: 'none', position: 'absolute', top: insets.top + orb.top, left: 0, right: 0, height: orb.size, alignItems: 'center' }}>
          <Orb color={orb.color} size={orb.size} />
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

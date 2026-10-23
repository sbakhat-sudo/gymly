import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActivePageHeader, type PageHeader } from '@/lib/page-header-context';
import { radius, spacing, useTheme } from '@/lib/theme';
import { ROLE_TOP_BAR_HEIGHT, SIDEBAR_WIDTH } from '@/lib/use-sidebar-mode';

import { PageTitle } from './PageTitle';
import { TodayBadge } from './TodayBadge';

export { ROLE_TOP_BAR_HEIGHT };

function glow(): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 30px -8px rgba(0,0,0,0.35)' } as ViewStyle,
    android: { elevation: 6 },
    default: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  });
}

/**
 * Fixed at the same spot on every screen, all inside one floating "glass" card — same translucent
 * background/border/shadow language as the sidebar's own card (`PillTabBar.tsx`), so this reads as
 * one more piece of the same floating chrome instead of three loose, unrelated elements scattered
 * across a bare background. Left to right: the current screen's own title+icon (from
 * `usePageHeader`/`usePageHeaderNode`, registered by each screen via `ScreenHeader`), right after
 * the sidebar — and a fixed `TodayBadge` (always today, not clickable — see that component for why
 * it's deliberately not the same thing as a list's own `DateBadge` filter) + the role's
 * notification bell (`children`), pinned to the right edge of the card. None of it inside any
 * screen's own scrolling content, where the title used to scroll out of view with the rest of the
 * page and a bell used to sit at a width that shifted with the title next to it. Rendered once per
 * role layout (`(manager|coach|admin)/_layout.tsx`), alongside the `<Tabs>` it sits on top of — not
 * per screen, so it can never drift or go missing on a screen that forgot to render it.
 */
export function RoleTopBar({ children }: { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const header = useActivePageHeader();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.lg,
        left: SIDEBAR_WIDTH + spacing.lg,
        right: spacing.lg,
        zIndex: 10,
      }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: theme.tabBar,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            paddingVertical: spacing.sm,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
          },
          glow(),
        ]}>
        {header ? <ActiveTitle header={header} /> : <View />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TodayBadge />
          {children}
        </View>
      </View>
    </View>
  );
}

/** Same `PageTitle` every screen used to render inline (bold 46px "display" type, 32px icon
 * circle) — not a smaller custom rendering, so sections look exactly as they did before this
 * became a fixed bar instead of scrolling content. */
function ActiveTitle({ header }: { header: PageHeader }) {
  if ('node' in header) return <>{header.node}</>;
  return <PageTitle icon={header.icon} label={header.label} />;
}

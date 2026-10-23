import { Platform, useWindowDimensions } from 'react-native';

/** Width of the left sidebar nav rendered in place of the floating pill tab bar. Shared between
 * `PillTabBar` (which draws it) and `Screen` (which reserves room for it), so they can't drift. */
// A slim icon rail: 10px page margin + a 60px card (52px buttons) + 10px, so every section keeps as much
// room as possible for its own content. The section name appears on hover (see `PillTabBar`).
export const SIDEBAR_WIDTH = 80;

/** Reserved height `Screen.tsx` adds to its top padding in sidebar mode, so scrolling content
 * never starts underneath `RoleTopBar` — defined here, not in `RoleTopBar.tsx`/`DateBadge.tsx`
 * (both need it, and importing it from either one into the other would be a circular import).
 * `RoleTopBar`'s card is its tallest child (the 44px date badge / bell) plus `spacing.sm` padding top
 * and bottom plus its 1px border on each side — padded a little further past that exact sum so the
 * content below never looks like it's touching the card. */
export const ROLE_TOP_BAR_HEIGHT = 66;

/** True once the Manager/Coach/Admin web app is wide enough to read as a desktop app rather than
 * a phone screen — same `900` breakpoint the Benvenuto landing page already uses. Native (even on
 * a tablet) always keeps the bottom pill bar; only the web build switches to a sidebar. */
export function useSidebarMode(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 900;
}

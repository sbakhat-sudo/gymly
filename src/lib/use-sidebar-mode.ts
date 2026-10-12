import { Platform, useWindowDimensions } from 'react-native';

/** Width of the left sidebar nav rendered in place of the floating pill tab bar. Shared between
 * `PillTabBar` (which draws it) and `Screen` (which reserves room for it), so they can't drift. */
export const SIDEBAR_WIDTH = 104;

/** True once the Manager/Coach/Admin web app is wide enough to read as a desktop app rather than
 * a phone screen — same `900` breakpoint the Benvenuto landing page already uses. Native (even on
 * a tablet) always keeps the bottom pill bar; only the web build switches to a sidebar. */
export function useSidebarMode(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 900;
}

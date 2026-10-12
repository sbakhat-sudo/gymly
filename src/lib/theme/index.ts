import { useColorScheme } from 'react-native';

import { useAppState } from '../app-state';

import { darkPalette, lightPalette, type Palette } from './tokens';

export * from './tokens';

/**
 * Active palette. `themePref` (Settings → Aspetto) is 'auto' by default: it follows
 * `useColorScheme()`, which React Native re-reports live when the OS theme changes — no
 * restart needed. 'light'/'dark' force the palette regardless of the system setting.
 */
export function useTheme(): Palette & { isDark: boolean } {
  const { themePref } = useAppState();
  const scheme = useColorScheme();
  const isDark = themePref === 'auto' ? scheme === 'dark' : themePref === 'dark';
  return { ...(isDark ? darkPalette : lightPalette), isDark };
}

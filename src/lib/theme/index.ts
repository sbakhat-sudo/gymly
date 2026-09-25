import { useColorScheme } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './tokens';

export * from './tokens';

/** Active palette, following the system appearance (light/dark). */
export function useTheme(): Palette & { isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { ...(isDark ? darkPalette : lightPalette), isDark };
}

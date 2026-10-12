import { Image, View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { AppText } from './AppText';

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

interface AvatarProps {
  uri?: string | null;
  name: string | null;
  size?: number;
  /** Background behind the initials fallback — lets callers keep their own per-role tint (e.g. the
   * Manager's presence list colours a coach differently from a client). Defaults to the brand primary. */
  tint?: string;
  onTint?: string;
}

/** A person's photo if they've set one, else their initials on a coloured circle — same size/shape
 * either way, so swapping between the two never reflows a list. */
export function Avatar({ uri, name, size = 44, tint, onTint }: AvatarProps) {
  const theme = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceAlt }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint ?? theme.primary,
      }}>
      <AppText color={onTint ?? theme.onPrimary} style={{ fontWeight: '700', fontSize: size * 0.34 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}

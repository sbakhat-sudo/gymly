import { Pressable, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

import { StarFilledIcon, StarIcon } from './icons';

const STARS = [1, 2, 3, 4, 5] as const;

/** Tappable 1–5 star picker — the Client's rating input after check-out. */
export function StarRatingInput({ value, onChange, size = 30 }: { value: number; onChange: (next: number) => void; size?: number }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View accessibilityRole="adjustable" style={{ flexDirection: 'row', gap: 8 }}>
      {STARS.map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} accessibilityRole="button" accessibilityLabel={t('feedback.rating.stars', { n })} hitSlop={8}>
          {n <= value ? <StarFilledIcon color={theme.accent} size={size} /> : <StarIcon color={theme.textMuted} size={size} />}
        </Pressable>
      ))}
    </View>
  );
}

/** Read-only stars — Coach/Manager rating lists. Each icon is already decorative on its own (see
 * `icons.tsx`'s shared `Icon` wrapper); the outer view carries the one spoken label for the group. */
export function StarRatingDisplay({ value, size = 16 }: { value: number; size?: number }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={t('feedback.rating.stars', { n: value })} style={{ flexDirection: 'row', gap: 2 }}>
      {STARS.map((n) => (n <= value ? <StarFilledIcon key={n} color={theme.accent} size={size} /> : <StarIcon key={n} color={theme.textMuted} size={size} />))}
    </View>
  );
}

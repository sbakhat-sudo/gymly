import { Pressable, View } from 'react-native';

import { decorativeA11yProps } from '@/lib/a11y';
import { useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { BellIcon } from './icons';

/** Same small glass-pill bell used on the Admin dashboard header — a plain red dot by default
 * (Admin's original behaviour, unchanged), or the actual count when `showCount` is on (the
 * Manager's notifications button, which combines more than one source). */
export function NotificationBell({
  count,
  onPress,
  showCount = false,
  accessibilityLabel,
}: {
  count: number;
  onPress: () => void;
  showCount?: boolean;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.85 : 1,
      })}>
      <BellIcon color={theme.text} size={20} />
      {count > 0 ? (
        showCount ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: theme.danger,
              borderWidth: 1.5,
              borderColor: theme.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText color={theme.onDanger} style={{ fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {count > 99 ? '99+' : count}
            </AppText>
          </View>
        ) : (
          <View
            {...decorativeA11yProps}
            style={{
              position: 'absolute',
              top: 6,
              right: 7,
              width: 11,
              height: 11,
              borderRadius: 6,
              backgroundColor: theme.danger,
              borderWidth: 1.5,
              borderColor: theme.background,
            }}
          />
        )
      ) : null}
    </Pressable>
  );
}

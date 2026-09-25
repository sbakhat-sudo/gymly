import { Pressable, View } from 'react-native';

import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name of the whole group (e.g. "Lingua"). */
  label: string;
}

/** Single-choice control. Wraps onto several lines rather than shrinking below the 44pt touch target. */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={o.label}
            style={{
              minHeight: MIN_TAP,
              minWidth: MIN_TAP,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.primary : theme.surfaceAlt,
              borderWidth: 1.5,
              borderColor: selected ? theme.primary : theme.border,
            }}>
            <AppText color={selected ? theme.onPrimary : theme.text} style={{ fontWeight: selected ? '700' : '500' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

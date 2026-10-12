import { Pressable, View } from 'react-native';

import { MIN_TAP, radius, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Track fill; defaults to the page background (as inside a card). */
  trackColor?: string;
  /** Spoken name of the whole group (e.g. "Lingua"). */
  label: string;
}

/**
 * Aurora single-choice control: a pill track in the page colour, the chosen option inverted
 * (text colour fill). Options share the width equally; labels wrap rather than shrink below 44pt.
 */
export function Segmented<T extends string>({ options, value, onChange, label, trackColor }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: trackColor ?? theme.background }}>
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
              flex: 1,
              minHeight: MIN_TAP,
              paddingHorizontal: 8,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.text : 'transparent',
            }}>
            <AppText
              color={selected ? theme.background : theme.textMuted}
              style={{ fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, type ViewStyle } from 'react-native';

import { useReduceMotion } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

const W = 51;
const H = 31;
const KNOB = 27;

const KNOB_SHADOW = Platform.select<ViewStyle>({
  web: { boxShadow: '0 2px 4px rgba(0,0,0,.3)' } as ViewStyle,
  android: { elevation: 2 },
  default: { shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } },
});

interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Spoken name ("Attiva notifiche"). */
  accessibilityLabel: string;
  disabled?: boolean;
}

/**
 * Aurora on/off switch: identical on iOS, Android and web (the platform `Switch` looks different on
 * each, and on web defaults to a teal thumb). Exposes the `switch` role and checked/disabled state;
 * the 51×31 track sits inside a 44pt-tall hit area.
 */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false }: ToggleProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      x.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [value, reduceMotion, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [2, W - KNOB - 2] });

  // RN Web's accessibilityState.checked doesn't reliably surface as aria-checked in the DOM for
  // role="switch" — set it explicitly so screen readers/automated a11y checks see the real state.
  // RN's `aria-checked` prop takes a boolean (not a string) — RN Web serializes it to the DOM as
  // the correct string attribute (aria-checked="true"/"false") itself.
  const webA11yProps = Platform.OS === 'web' ? { 'aria-checked': value } : {};

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      {...webA11yProps}
      hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        justifyContent: 'center',
        backgroundColor: value ? theme.primary : theme.switchOff,
        opacity: disabled ? 0.45 : 1,
      }}>
      <Animated.View
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX }],
          ...KNOB_SHADOW,
        }}
      />
    </Pressable>
  );
}

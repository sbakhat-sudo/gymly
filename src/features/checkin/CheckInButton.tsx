import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { decorativeA11yProps } from '@/lib/a11y';
import { useReduceMotion } from '@/lib/hooks';
import { fontFamily, spacing, useTheme } from '@/lib/theme';

const SIZE = 196;

interface CheckInButtonProps {
  checkedIn: boolean;
  busy: boolean;
  /** "01:24:33" while checked in; null before the first check-in. */
  elapsedLabel: string | null;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function glow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 20px 60px -10px ${color}, inset 0 -8px 20px rgba(0,0,0,.15), inset 0 8px 20px rgba(255,255,255,.2)` } as ViewStyle,
    android: { elevation: 10 },
    default: { shadowColor: color, shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  });
}

/** Big, central, pulsing (while idle) circular action — the whole point of the Check-in tab. */
export function CheckInButton({ checkedIn, busy, elapsedLabel, label, accessibilityLabel, onPress }: CheckInButtonProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  // `useState`, not `useRef`: reading `.current` of a ref during render is disallowed by this
  // project's lint rules (React Compiler-friendly), so the mutable Animated.Value is state instead.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (checkedIn || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [checkedIn, reduceMotion, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  // Checked in = the red band pair (an "exit" action), idle = brand accent: the button never borrows
  // green, so it can't be read as a statement about how busy the gym is.
  const bg = checkedIn ? theme.band.red.solid : theme.accent;
  const fg = checkedIn ? theme.band.red.onSolid : theme.onAccent;

  return (
    <View style={{ height: 280, alignItems: 'center', justifyContent: 'center' }}>
      {!checkedIn && !reduceMotion ? (
        <Animated.View
          {...decorativeA11yProps}
          style={{
            position: 'absolute',
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: bg,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => [
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            backgroundColor: bg,
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          glow(bg),
        ]}>
        <AppText
          color={fg}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ fontFamily: fontFamily.displayHeavy, fontSize: 24, lineHeight: 30, letterSpacing: 24 * -0.02 }}>
          {label}
        </AppText>
        {elapsedLabel ? (
          <AppText color={fg} style={{ fontFamily: fontFamily.mono, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] }}>
            {elapsedLabel}
          </AppText>
        ) : null}
      </Pressable>
    </View>
  );
}

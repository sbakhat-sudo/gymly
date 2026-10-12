import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { decorativeA11yProps } from '@/lib/a11y';
import { useReduceMotion } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

/**
 * Small solid dot with a pulsing halo behind it (1.6 s loop) — the "live update" tell, used next to
 * the LIVE label and anywhere else something is refreshing in real time. Deliberately NOT coloured
 * with a band colour (`theme.band.*`): those carry real meaning (§4.4) and a green dot could read
 * as "the gym is free" regardless of the actual band. Purely decorative: pair it with a text label.
 */
export function LiveDot({ size = 7, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const dotColor = color ?? theme.accent;
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.55, 0.15, 0] });

  return (
    <View {...decorativeA11yProps} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!reduceMotion ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColor,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }} />
    </View>
  );
}

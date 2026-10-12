import { useEffect, useState } from 'react';
import { Animated, type ColorValue } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { decorativeA11yProps } from '@/lib/a11y';
import { useReduceMotion } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

interface OrbProps {
  color: ColorValue;
  size: number;
  top?: number;
  left?: number;
  right?: number;
}

let nextOrbId = 0;

/**
 * A blurred, "breathing" light behind the hero content — the Aurora signature. No real blur
 * (`expo-blur` is out of this project's allowed dependency set): the glow itself comes from a
 * radial gradient fading to transparent, so it reads as soft without any blur filter.
 * Respects "reduce motion" (static at the resting scale instead of animating).
 */
export function Orb({ color, size, top, left, right }: OrbProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  const [gradientId] = useState(() => `orb-gradient-${++nextOrbId}`);

  useEffect(() => {
    if (reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });

  return (
    <Animated.View
      {...decorativeA11yProps}
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top,
        left,
        right,
        width: size,
        height: size,
        opacity: theme.orbOpacity,
        transform: [{ scale }],
      }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset="30%" stopColor={color} stopOpacity={0.53} />
            <Stop offset="68%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

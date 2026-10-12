import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

import { useReduceMotion } from '@/lib/hooks';

/** Clean fade-up entrance for a card, staggerable via `delay`. Skips the motion entirely under reduce-motion. */
export function FadeSlideIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, progress, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

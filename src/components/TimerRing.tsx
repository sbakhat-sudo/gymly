import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { decorativeA11yProps } from '@/lib/a11y';
import { fontFamily } from '@/lib/theme';

import { AppText } from './AppText';

const NUM_TICKS = 36;
const GAP_DEG = 34;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * t);
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

/** Piecewise lerp across 3 stops: first half green→amber, second half amber→red. */
function lerp3(colors: readonly [string, string, string], t: number): string {
  return t <= 0.5 ? lerpColor(colors[0], colors[1], t / 0.5) : lerpColor(colors[1], colors[2], (t - 0.5) / 0.5);
}

/**
 * Decorative radial dial around the live stopwatch digits — a static bezel, not a progress
 * indicator (elapsed time has no fixed target duration). Ticks sweep green → amber → red (the
 * app's own band colours, not an arbitrary palette) and the whole ring turns by exactly one
 * second's worth of rotation (6°, a full turn per minute) on every `rotationDeg` update, so it
 * visibly advances in lockstep with the digits instead of sitting still.
 */
export function TimerRing({
  label,
  size = 64,
  colors,
  rotationDeg = 0,
}: {
  label: string;
  size?: number;
  colors: readonly [string, string, string];
  rotationDeg?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.04;
  const tickLength = size * 0.14;
  const outerR = size / 2 - strokeWidth;
  const innerR = outerR - tickLength;
  const startDeg = -90 + GAP_DEG / 2;
  const sweepDeg = 360 - GAP_DEG;

  const ticks = Array.from({ length: NUM_TICKS }, (_, i) => {
    const t = i / (NUM_TICKS - 1);
    const rad = ((startDeg + t * sweepDeg) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      key: i,
      x1: cx + innerR * cos,
      y1: cy + innerR * sin,
      x2: cx + outerR * cos,
      y2: cy + outerR * sin,
      color: lerp3(colors, t),
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: `${rotationDeg}deg` }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} {...decorativeA11yProps}>
          {ticks.map((tick) => (
            <Line key={tick.key} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={tick.color} strokeWidth={strokeWidth} strokeLinecap="round" />
          ))}
        </Svg>
      </View>
      <AppText
        numberOfLines={1}
        style={{ fontFamily: fontFamily.mono, fontSize: labelFontSize(label, size, innerR), fontVariant: ['tabular-nums'], maxWidth: innerR * 1.9 }}>
        {label}
      </AppText>
    </View>
  );
}

/** `adjustsFontSizeToFit`/`minimumFontScale` are iOS/Android-only — react-native-web doesn't
 * implement either, so on this project's web-only screens (the Manager's presence list is the one
 * caller) the label never actually shrank and just truncated with "…" once a shift passed an hour
 * (`formatStopwatch`'s "H:MM:SS" form is longer than its usual "MM:SS"). Sizing the font from the
 * label's own length instead — a plain character-width estimate for the monospace face — shrinks it
 * correctly on every platform, not just the ones the native-only prop happens to cover. */
function labelFontSize(label: string, size: number, innerR: number): number {
  const base = size * 0.2;
  const maxWidth = innerR * 1.9;
  const estimatedWidth = label.length * base * 0.62;
  return estimatedWidth > maxWidth ? Math.max(size * 0.11, maxWidth / (label.length * 0.62)) : base;
}

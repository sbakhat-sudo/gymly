import { Text, type ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { decorativeA11yProps } from '@/lib/a11y';
import { fontFamily, useTheme } from '@/lib/theme';

interface LogoMarkProps {
  size?: number;
  /** Handle + body colour. */
  color?: ColorValue;
  /** The dial's pivot — the live band's solid colour (green by default). */
  bandColor?: ColorValue;
  /** Dial arc/needle colour — must read against `color` (normally the surface behind the mark). */
  bgColor?: ColorValue;
}

/**
 * "Kettlebell-contachilometri": a kettlebell whose body doubles as a gauge dial, its pivot in the
 * live band's colour. Decorative — the element that contains it (header, tile) carries the a11y label.
 */
export function LogoMark({ size = 32, color, bandColor, bgColor }: LogoMarkProps) {
  const theme = useTheme();
  const c = color ?? theme.text;
  const bg = bgColor ?? theme.surface;
  const band = bandColor ?? theme.band.green.solid;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" {...decorativeA11yProps}>
      <Path d="M31 47C19 38 24 15 50 15S81 38 69 47" stroke={c} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={64} r={28} fill={c} />
      <Path d="M35 70a15 15 0 0 1 30 0" stroke={bg} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M50 70l8-12" stroke={bg} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={50} cy={70} r={5} fill={band} />
    </Svg>
  );
}

export function Wordmark({ size = 22, color }: { size?: number; color?: ColorValue }) {
  const theme = useTheme();
  return (
    <Text
      style={{ fontFamily: fontFamily.display, fontSize: size, letterSpacing: size * -0.06, color: (color ?? theme.text) as string }}>
      gymly
    </Text>
  );
}

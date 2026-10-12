import Svg, { Line } from 'react-native-svg';

import { decorativeA11yProps } from '@/lib/a11y';
import { useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

const TICKS = 64;
const SWEEP_DEG = 270;
const START_DEG = 135;

/**
 * How far round the dial each band reaches. Deliberately coarse — three fixed stops, one per band —
 * so the dial repeats the band and never suggests a finer measurement (or a count) than the band itself.
 */
const LEVEL: Record<Band, number> = { green: 0.3, amber: 0.62, red: 0.9 };

/** Aurora's live dial: a 270° ring of ticks, filled up to the band's stop in the band colour. Decorative. */
export function LiveGauge({ band, size }: { band: Band; size: number }) {
  const theme = useTheme();
  const on = theme.band[band].solid;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = ((START_DEG + (SWEEP_DEG * i) / (TICKS - 1)) * Math.PI) / 180;
    const lit = i / (TICKS - 1) <= LEVEL[band];
    const outer = lit ? 146 : 142;
    return {
      x1: 150 + 132 * Math.cos(a),
      y1: 150 + 132 * Math.sin(a),
      x2: 150 + outer * Math.cos(a),
      y2: 150 + outer * Math.sin(a),
      color: lit ? on : theme.tickOff,
    };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300" {...decorativeA11yProps}>
      {ticks.map((k, i) => (
        <Line key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} stroke={k.color} strokeWidth={3.2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

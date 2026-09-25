import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { Band } from '@/schemas';

/**
 * A distinct SHAPE per band, so the level never depends on colour alone (colour-blind members):
 * circle = Libera, triangle = Moderata, square = Affollata. Always accompanied by a text label.
 */
export function BandIcon({ band, size = 24, color }: { band: Band; size?: number; color: ColorValue }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {band === 'green' ? <Circle cx={12} cy={12} r={8.5} fill={color} /> : null}
      {band === 'amber' ? (
        <Path d="M12 3.5 21.5 20h-19z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      ) : null}
      {band === 'red' ? <Rect x={4} y={4} width={16} height={16} rx={3} fill={color} /> : null}
    </Svg>
  );
}

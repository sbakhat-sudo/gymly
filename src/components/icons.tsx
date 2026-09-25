import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: ColorValue;
}

/** Line icons drawn with react-native-svg (bundled in Expo Go): no icon font, no extra dependency. */
function Icon({ size = 24, color, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative: the tab/button that contains the icon carries the accessible label.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {children}
    </Svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Icon>
);

export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m9 5 7 7-7 7" />
  </Icon>
);

export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <Circle cx={15} cy={7} r={2} />
    <Circle cx={9} cy={17} r={2} />
  </Icon>
);

import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { decorativeA11yProps } from '@/lib/a11y';

interface IconProps {
  size?: number;
  color: ColorValue;
  strokeWidth?: number;
}

/** Line icons drawn with react-native-svg (bundled in Expo Go): no icon font, no extra dependency. */
function Icon({ size = 24, color, strokeWidth = 2, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative: the tab/button that contains the icon carries the accessible label.
      {...decorativeA11yProps}>
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

/** Solid star: the points balance chip and the "se entri adesso" pill. */
export const StarFilledIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" fill={p.color} />
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

/** Heartbeat line: the "Live" tab (real-time occupancy). */
export const PulseIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12h4l2-7 4 14 2-7h6" />
  </Icon>
);

/** Arrow into a door frame: the "Check-in" tab. */
export const LogInIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
    <Path d="M11 8l4 4-4 4M15 12H3" />
  </Icon>
);

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M11 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
    <Path d="M13 8l4 4-4 4M17 12H9" />
  </Icon>
);

/** Arrow out of a door frame: the check-in FAB once checked in (tap to check out). */
export const ExitIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
    <Path d="M8 8l-4 4 4 4M4 12h11" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m15 5-7 7 7 7" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** Two overlapping heads: the Manager's "Persone" (roster) tab. */
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={9} cy={8} r={3} />
    <Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <Path d="M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.8-1.9-5.1-4.5-5.8" />
  </Icon>
);

/** Tray with a dot: the Manager's "Richieste" (pending access requests) tab. */
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12h4l2 3h6l2-3h4" />
    <Path d="M5.5 5h13a1 1 0 0 1 1 .8l1.5 6.2v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l1.5-6.2A1 1 0 0 1 5.5 5z" />
  </Icon>
);

/** Orari's "avvisami" reminder buttons (a free window or the best moment today). */
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 16v-4.5a6 6 0 1 1 12 0V16l2 3H4z" />
    <Path d="M10.3 20.5a1.8 1.8 0 0 0 3.4 0" />
  </Icon>
);

/** Card with a stripe: the Admin's "Pagamento" row. */
export const CreditCardIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <Path d="M3 10h18" />
  </Icon>
);

/** Dumbbell: the Admin's "Palestre" tab (reads as "gym" more directly than a plain house). */
export const DumbbellIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 9v6M7 6.5v11M17 6.5v11M20 9v6" />
    <Path d="M7 12h10" />
  </Icon>
);

/** Gear: the Admin's "Parametri" row (distinct from the Impostazioni tab's SlidersIcon). */
export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" />
    <Circle cx={12} cy={12} r={3} />
  </Icon>
);

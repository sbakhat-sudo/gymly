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

/** Equipment/structure issue reports — the Manager's "Issues" tab. */
export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 4 2.5 20h19Z" strokeLinejoin="round" />
    <Path d="M12 10v4M12 17h.01" />
  </Icon>
);

/** Row-level "more actions" trigger (a table row's "…" menu). */
export const MoreIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={p.strokeWidth ?? 2.6}>
    <Path d="M12 5.5h.01M12 12h.01M12 18.5h.01" />
  </Icon>
);

/** Column sort/reorder handle (a table header's drag affordance). */
export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M8 7 5 4 2 7M5 4v16M16 17l3 3 3-3M19 20V4" />
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

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    <Path d="M4 10h16M8 3v4M16 3v4" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 12h14" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 5v14M5 12h14" />
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

/** Gear: config/settings icon (distinct from the Impostazioni tab's SlidersIcon). */
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

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M21 21l-4.3-4.3" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3v12" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M4 21h16" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3.5 12a8.5 8.5 0 0 1 14.5-6" />
    <Path d="M20.5 12a8.5 8.5 0 0 1-14.5 6" />
    <Path d="M18 3v4h-4" />
    <Path d="M6 21v-4h4" />
  </Icon>
);

/** "Orario migliore" suggestion card. */
export const LightbulbIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9 18h6M10 21h4" />
    <Path d="M12 3a6 6 0 0 0-3.5 10.9c.6.44 1 1.17 1 1.95V16h5v-.15c0-.78.4-1.5 1-1.95A6 6 0 0 0 12 3Z" />
  </Icon>
);

/** Rising-trend arrow: a card header icon and a "in crescita" badge glyph. */
export const TrendingUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m3 17 6-6 4 4 8-8" />
    <Path d="M16 7h5v5" />
  </Icon>
);

/** Speedometer: the Manager's "Occupazione" stat card. */
export const GaugeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 15a8 8 0 1 1 16 0" />
    <Path d="M12 15l4-5" strokeLinecap="round" />
    <Path d="M12 15h.01" strokeLinecap="round" strokeWidth={(p.strokeWidth ?? 2) + 1} />
  </Icon>
);

/** Stacked layers: the Coach's "Oggi" (today's hours) stat. */
export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m12 3 9 5-9 5-9-5 9-5Z" strokeLinejoin="round" />
    <Path d="m3 13 9 5 9-5" />
    <Path d="m3 17 9 5 9-5" />
  </Icon>
);

/** Ascending bars: the Coach's "Media settimanale" stat. */
export const BarChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 20V12M12 20V4M19 20v-7" strokeLinecap="round" />
  </Icon>
);

/** Map pin: the Manager's "Posizione palestra" lat/lng fields. */
export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" strokeLinejoin="round" />
    <Circle cx={12} cy={9} r={2.5} />
  </Icon>
);

/** Crosshair/target: GPS precision and the "use my position" action. */
export const CrosshairIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={7} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
  </Icon>
);

/** Chat bubble: "Message" actions (e.g. open a WhatsApp chat with someone). */
export const MessageCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" strokeLinejoin="round" />
  </Icon>
);

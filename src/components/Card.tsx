import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme, type Palette } from '@/lib/theme';
import type { Band } from '@/schemas';

import { AppText } from './AppText';

/** `surface` = neutral card (the default). Anything else is a solid colour block. */
export type CardTone = 'surface' | 'primary' | 'accent' | Band;

interface CardProps extends ViewProps {
  children: ReactNode;
  /** Dashed border: used for anything that is NOT a live measurement (forecast, stale, unavailable). Ignored on a coloured tone. */
  dashed?: boolean;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
}

/** The text/icon colour that reads correctly on a given card tone's fill. */
export function cardToneOnColor(theme: Palette, tone: CardTone): string {
  if (tone === 'surface') return theme.text;
  if (tone === 'primary') return theme.onPrimary;
  if (tone === 'accent') return theme.onAccent;
  return theme.band[tone].onSolid;
}

function cardToneFill(theme: Palette, tone: CardTone): string {
  if (tone === 'surface') return theme.surface;
  if (tone === 'primary') return theme.primary;
  if (tone === 'accent') return theme.accent;
  return theme.band[tone].solid;
}

/** Aurora card: a borderless rounded block on the page background (a dashed outline only for non-live data). */
export function Card({ children, dashed = false, tone = 'surface', style, ...rest }: CardProps) {
  const theme = useTheme();
  const outlined = dashed && tone === 'surface';
  return (
    <View
      style={[
        {
          backgroundColor: cardToneFill(theme, tone),
          borderRadius: radius.card,
          borderWidth: outlined ? 1.5 : 0,
          borderStyle: 'dashed',
          borderColor: theme.borderStrong,
          padding: 18,
          gap: spacing.md,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

/** Unbounded section heading inside or above a card ("Premi", "Dettaglio di lunedì"). */
export function SectionTitle({ children, color }: { children: string; color?: string }) {
  return (
    <AppText variant="title" color={color} accessibilityRole="header">
      {children}
    </AppText>
  );
}

/** Small caps eyebrow above a group of related fields ("NOTIFICHE", "COME SI GUADAGNANO", …). */
export function SectionLabel({ children, color }: { children: string; color?: string }) {
  return (
    <AppText
      variant="caption"
      muted={color === undefined}
      color={color}
      accessibilityRole="header"
      style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 12 * 0.08 }}>
      {children}
    </AppText>
  );
}

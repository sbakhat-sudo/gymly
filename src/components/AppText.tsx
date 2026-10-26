import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { MAX_FONT_SCALE, fontFamily, fontSize, useTheme } from '@/lib/theme';

export type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'caption';

type Weight = NonNullable<TextStyle['fontWeight']>;

/** Aurora type scale: Unbounded for display/headline/title, Geist for running text. */
const VARIANTS: Record<TextVariant, { fontSize: number; fontWeight: Weight; lineHeight: number; letterSpacing?: number }> = {
  display: { fontSize: fontSize.display, fontWeight: '700', lineHeight: 50, letterSpacing: fontSize.display * -0.05 },
  headline: { fontSize: fontSize.headline, fontWeight: '700', lineHeight: 36, letterSpacing: fontSize.headline * -0.05 },
  title: { fontSize: fontSize.title, fontWeight: '600', lineHeight: 24, letterSpacing: fontSize.title * -0.04 },
  body: { fontSize: fontSize.body, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: fontSize.caption, fontWeight: '500', lineHeight: 18 },
};

const DISPLAY_VARIANTS: ReadonlySet<TextVariant> = new Set(['display', 'headline', 'title']);

/**
 * Custom fonts ship one file per weight: asking for `fontWeight: '700'` on "Geist_400Regular" makes
 * Android fall back to the system font and web synthesise a fake bold. So the weight picks the
 * file, and `fontWeight` itself is dropped once a family is chosen.
 */
function familyFor(variant: TextVariant, weight: Weight | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  if (DISPLAY_VARIANTS.has(variant)) {
    if (w >= 800) return fontFamily.displayHeavy;
    if (w >= 700) return fontFamily.display;
    return fontFamily.displaySemi;
  }
  if (w >= 700) return fontFamily.bodyBold;
  if (w >= 600) return fontFamily.bodySemi;
  if (w >= 500) return fontFamily.bodyMedium;
  return fontFamily.body;
}

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
  /** Overrides the themed colour (e.g. `onSolid` text on a band card). */
  color?: string;
}

/**
 * The single text primitive: themed colour, Aurora type scale, and dynamic type honoured (the OS
 * font scale applies) but capped so the largest accessibility sizes cannot break layouts.
 * An explicit `fontFamily` in `style` (e.g. Geist Mono) wins over the variant's family.
 */
export function AppText({ variant = 'body', muted = false, color, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const base = VARIANTS[variant];
  const flat = StyleSheet.flatten(style) ?? {};
  const family = flat.fontFamily ?? familyFor(variant, flat.fontWeight ?? base.fontWeight);
  // Unbounded is a wide, heavy face: at the -4%/-5% tracking the scale asks for, letters touch and
  // titles ("Dettaglio Manager") turn into a smudge at card-title sizes. Keep tracking open there.
  const size = flat.fontSize ?? base.fontSize;
  const tracking = flat.letterSpacing ?? base.letterSpacing;
  const isDisplayFace = family === fontFamily.display || family === fontFamily.displaySemi || family === fontFamily.displayHeavy;
  const openTracking = isDisplayFace && size <= 40 && tracking !== undefined ? { letterSpacing: Math.max(tracking, size * -0.01) } : null;
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        base,
        { color: color ?? (muted ? theme.textMuted : theme.text) },
        flat,
        openTracking,
        { fontFamily: family, fontWeight: undefined },
      ]}
      {...rest}
    />
  );
}

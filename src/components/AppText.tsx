import { Text, type TextProps } from 'react-native';

import { MAX_FONT_SCALE, fontSize, useTheme } from '@/lib/theme';

export type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'caption';

const VARIANTS: Record<TextVariant, { fontSize: number; fontWeight: '400' | '600' | '700'; lineHeight: number }> = {
  display: { fontSize: fontSize.display, fontWeight: '700', lineHeight: 52 },
  headline: { fontSize: fontSize.headline, fontWeight: '700', lineHeight: 36 },
  title: { fontSize: fontSize.title, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: fontSize.body, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: fontSize.caption, fontWeight: '400', lineHeight: 18 },
};

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
  /** Overrides the themed colour (e.g. `onSolid` text on a band card). */
  color?: string;
}

/**
 * The single text primitive: themed colour, type scale, and dynamic type honoured (the OS font
 * scale applies) but capped so the largest accessibility sizes cannot break layouts.
 */
export function AppText({ variant = 'body', muted = false, color, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[VARIANTS[variant], { color: color ?? (muted ? theme.textMuted : theme.text) }, style]}
      {...rest}
    />
  );
}

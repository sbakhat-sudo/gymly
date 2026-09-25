import type { Band } from '@/schemas';

/**
 * Design tokens: the only place colours, spacing, radii and type sizes are defined.
 * Every text/background pairing below is checked for WCAG AA (≥ 4.5:1) by a unit test.
 */
export interface BandColors {
  /** Strong fill (hero card, heatmap cell). */
  solid: string;
  /** Text/icon colour on `solid`. */
  onSolid: string;
  /** Soft tint (chips, list rows). */
  soft: string;
  /** Text/icon colour on `soft`. */
  onSoft: string;
}

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  band: Record<Band, BandColors>;
}

export const lightPalette: Palette = {
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EEEA',
  text: '#0E1A15',
  textMuted: '#46554E',
  border: '#CBD5CF',
  primary: '#0B6E4F',
  onPrimary: '#FFFFFF',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  band: {
    green: { solid: '#15703B', onSolid: '#FFFFFF', soft: '#DDF3E4', onSoft: '#0E4D28' },
    amber: { solid: '#F5B700', onSolid: '#241A00', soft: '#FFF1C7', onSoft: '#5C4300' },
    red: { solid: '#B3261E', onSolid: '#FFFFFF', soft: '#FCDAD7', onSoft: '#7A1510' },
  },
};

export const darkPalette: Palette = {
  background: '#0B1310',
  surface: '#141F1A',
  surfaceAlt: '#1C2A23',
  text: '#EAF2EE',
  textMuted: '#A6B5AD',
  border: '#2C3B33',
  primary: '#4FD1A0',
  onPrimary: '#06231A',
  danger: '#FF8A80',
  onDanger: '#2A0503',
  band: {
    green: { solid: '#2FB36A', onSolid: '#03170C', soft: '#173A27', onSoft: '#9BE8BE' },
    amber: { solid: '#FFC629', onSolid: '#241A00', soft: '#3A2F0D', onSoft: '#FFDD85' },
    red: { solid: '#FF6B60', onSolid: '#2A0503', soft: '#43191A', onSoft: '#FFB4AD' },
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Base sizes; the OS font scale (dynamic type) multiplies them, capped by `MAX_FONT_SCALE`. */
export const fontSize = { caption: 13, body: 16, title: 22, headline: 30, display: 44 } as const;

/** Minimum touch target on both platforms (Apple HIG 44pt; Material asks 48dp, so we add a margin where possible). */
export const MIN_TAP = 44;

/** Cap on dynamic type so layouts stay intact at the largest accessibility sizes. */
export const MAX_FONT_SCALE = 1.6;

import type { Band } from '@/schemas';

/**
 * Design tokens: the only place colours, spacing, radii and type sizes are defined.
 *
 * Visual language: bold, rounded, colour-blocked cards on a near-black surface (dark is the
 * primary theme here; light is a derived, equally-tested variant, not an afterthought). Band
 * colours (green/amber/red) are untouched by this — they carry real meaning (§4.4 of the spec)
 * and must stay exactly what members already learned to read; only the surfaces, typography and
 * card treatment around them changed.
 *
 * Every text/background pairing below is checked for WCAG AA (≥ 4.5:1) by a unit test — except
 * `primary`/`accent` used as a plain icon glyph on a neutral surface (never as body text), which
 * WCAG 1.4.11 only requires at 3:1, and `faint` (~3.1:1, below full text AA — a deliberate
 * trade-off, never for anything conveying meaning alone; see contrast.test.ts); the test file says
 * explicitly which threshold applies where.
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
  /** Brand blue: primary actions, points/brand accents. */
  primary: string;
  /** Deeper end of the primary gradient ("Per te" card). Decorative only: text on it uses `onPrimary`. */
  primaryDeep: string;
  onPrimary: string;
  /** Brand orange: secondary highlights, alternate action blocks. */
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  band: Record<Band, BandColors>;

  // ── Aurora: glass surfaces, floating chrome, decorative-only tones ──
  /** Slightly deeper than `background`, behind blurred orbs. */
  canvas: string;
  /** Faintest legible text tone — captions ≥ 11px only (see contrast.test.ts: 3:1, not 4.5:1). */
  faint: string;
  /** Heavier border for selected states (radio rings, etc.), decorative only. */
  borderStrong: string;
  /** Glass card fill (translucent). */
  glass: string;
  glassBorder: string;
  /** Faint neutral tint over any surface (logo tile, selected heatmap row). Decorative only. */
  glassTint: string;
  /** Secondary text over an orb (the hero hint): a little softer than `text`. */
  textSoft: string;
  /** Floating tab bar fill. */
  tabBar: string;
  /** Unfilled gauge tick. */
  tickOff: string;
  /** Neutral pill/chip fill over an orb or image. */
  chip: string;
  switchOff: string;
  /** Breathing-orb opacity (dimmer in light mode so it reads as a tint, not a blob). */
  orbOpacity: number;
}

export const lightPalette: Palette = {
  background: '#F2F2F5',
  surface: '#FFFFFF',
  surfaceAlt: '#E8E8ED',
  text: '#121214',
  textMuted: '#5B5B63',
  border: '#D8D8DE',
  primary: '#4453D6',
  primaryDeep: '#3441B8',
  onPrimary: '#FFFFFF',
  accent: '#C63E1D',
  onAccent: '#FFFFFF',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  band: {
    green: { solid: '#15703B', onSolid: '#FFFFFF', soft: '#DDF3E4', onSoft: '#0E4D28' },
    amber: { solid: '#A85D00', onSolid: '#FFFFFF', soft: '#FCE7C4', onSoft: '#6B4400' },
    red: { solid: '#B3261E', onSolid: '#FFFFFF', soft: '#FCDAD7', onSoft: '#7A1510' },
  },
  canvas: '#E4E4EA',
  faint: '#7A7A82',
  borderStrong: '#C9C9D0',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(0,0,0,0.07)',
  glassTint: 'rgba(0,0,0,0.04)',
  textSoft: 'rgba(18,18,20,0.75)',
  tabBar: 'rgba(255,255,255,0.82)',
  tickOff: 'rgba(0,0,0,0.10)',
  chip: 'rgba(255,255,255,0.70)',
  switchOff: '#D8D8DE',
  orbOpacity: 0.55,
};

export const darkPalette: Palette = {
  background: '#0E0E10',
  surface: '#1A1A1D',
  surfaceAlt: '#232326',
  text: '#F7F7F8',
  textMuted: '#9C9CA3',
  border: '#2C2C30',
  primary: '#5164DC',
  primaryDeep: '#3A47B0',
  onPrimary: '#FFFFFF',
  accent: '#FF5D36',
  onAccent: '#180500',
  danger: '#FF6B60',
  onDanger: '#2A0503',
  band: {
    green: { solid: '#2FB36A', onSolid: '#03170C', soft: '#173A27', onSoft: '#9BE8BE' },
    amber: { solid: '#FFC629', onSolid: '#241A00', soft: '#3A2F0D', onSoft: '#FFDD85' },
    red: { solid: '#FF6B60', onSolid: '#2A0503', soft: '#43191A', onSoft: '#FFB4AD' },
  },
  canvas: '#141416',
  faint: '#6E6E76',
  borderStrong: '#3A3A3F',
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassTint: 'rgba(255,255,255,0.06)',
  textSoft: 'rgba(247,247,248,0.8)',
  tabBar: 'rgba(26,26,29,0.78)',
  tickOff: 'rgba(255,255,255,0.14)',
  chip: 'rgba(0,0,0,0.35)',
  switchOff: '#39393D',
  orbOpacity: 1,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** `xl` is the big, fully-rounded corner used by the colour-blocked hero/stat cards. */
export const radius = { sm: 8, md: 12, lg: 20, card: 24, xl: 28, xxl: 32, sheet: 40, pill: 999 } as const;

/** Base sizes; the OS font scale (dynamic type) multiplies them, capped by `MAX_FONT_SCALE`. */
export const fontSize = { caption: 13, body: 16, title: 18, headline: 30, display: 46, balance: 72 } as const;

/**
 * Aurora type families (Unbounded / Geist / Geist Mono, loaded via `useFonts` in `app/_layout.tsx`).
 * Referencing an unloaded family just falls back to the OS default (no crash), but the app holds
 * the splash screen until `useFonts` resolves so this never actually happens post-boot.
 */
export const fontFamily = {
  display: 'Unbounded_700Bold',
  displayHeavy: 'Unbounded_800ExtraBold',
  displaySemi: 'Unbounded_600SemiBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',
  mono: 'GeistMono_600SemiBold',
} as const;

/** Minimum touch target on both platforms (Apple HIG 44pt; Material asks 48dp, so we add a margin where possible). */
export const MIN_TAP = 44;

/** Cap on dynamic type so layouts stay intact at the largest accessibility sizes. */
export const MAX_FONT_SCALE = 1.6;

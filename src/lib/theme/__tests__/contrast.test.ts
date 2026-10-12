import { BAND_ORDER } from '@/lib/domain/band';

import { contrastRatio, luminance } from '../contrast';
import { MIN_TAP, darkPalette, lightPalette, type Palette } from '../tokens';

/** WCAG 1.4.3: body text and text-on-solid-fill need 4.5:1. */
const AA_TEXT = 4.5;
/** WCAG 1.4.11: a plain icon glyph on a neutral surface (not text) only needs 3:1. */
const AA_ICON = 3.0;

function textPairs(p: Palette): [string, string, string][] {
  return [
    ['text on background', p.text, p.background],
    ['text on surface', p.text, p.surface],
    ['text on surfaceAlt', p.text, p.surfaceAlt],
    ['muted on background', p.textMuted, p.background],
    ['muted on surface', p.textMuted, p.surface],
    ['muted on surfaceAlt', p.textMuted, p.surfaceAlt],
    ['onPrimary on primary', p.onPrimary, p.primary],
    ['onAccent on accent', p.onAccent, p.accent],
    ['onDanger on danger', p.onDanger, p.danger],
    ['danger on background', p.danger, p.background],
    ['danger on surface', p.danger, p.surface],
    ...BAND_ORDER.flatMap(
      (band): [string, string, string][] => [
        [`${band}: onSolid on solid`, p.band[band].onSolid, p.band[band].solid],
        [`${band}: onSoft on soft`, p.band[band].onSoft, p.band[band].soft],
      ]
    ),
  ];
}

/** `primary`/`accent` are only ever used as a plain icon glyph (spinner, checkmark) on these surfaces — never as body text. */
function iconOnlyPairs(p: Palette): [string, string, string][] {
  return [
    ['primary icon on background', p.primary, p.background],
    ['primary icon on surface', p.primary, p.surface],
    ['accent icon on background', p.accent, p.background],
    ['accent icon on surface', p.accent, p.surface],
  ];
}

/**
 * `faint` is a deliberate below-AA trade-off (~3.1:1, not the full 4.5:1 text contrast): reserved
 * for the least critical captions (timestamps, footnotes) that are never the only carrier of
 * meaning, and never used for `fontSize.body` or anything that must be reliably legible.
 */
function smallCaptionPairs(p: Palette): [string, string, string][] {
  return [
    ['faint caption on background', p.faint, p.background],
    ['faint caption on surface', p.faint, p.surface],
    ['faint caption on surfaceAlt', p.faint, p.surfaceAlt],
  ];
}

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s palette: WCAG AA text contrast (4.5:1)', (_name, palette) => {
  it.each(textPairs(palette))('%s ≥ 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s palette: WCAG AA non-text (icon) contrast (3:1)', (_name, palette) => {
  it.each(iconOnlyPairs(palette))('%s ≥ 3:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_ICON);
  });
});

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s palette: WCAG 1.4.11-equivalent non-text contrast for `faint` (3:1)', (_name, palette) => {
  it.each(smallCaptionPairs(palette))('%s ≥ 3:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_ICON);
  });
});

describe('contrast helpers', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects non-#RRGGBB input', () => {
    expect(() => luminance('red')).toThrow(RangeError);
  });
});

it('touch target token meets the 44pt minimum', () => {
  expect(MIN_TAP).toBeGreaterThanOrEqual(44);
});

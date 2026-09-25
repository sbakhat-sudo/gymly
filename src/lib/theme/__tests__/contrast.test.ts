import { BAND_ORDER } from '@/lib/domain/band';

import { contrastRatio, luminance } from '../contrast';
import { MIN_TAP, darkPalette, lightPalette, type Palette } from '../tokens';

const AA = 4.5;

function textPairs(p: Palette): [string, string, string][] {
  const pairs: [string, string, string][] = [
    ['text on background', p.text, p.background],
    ['text on surface', p.text, p.surface],
    ['text on surfaceAlt', p.text, p.surfaceAlt],
    ['muted on background', p.textMuted, p.background],
    ['muted on surface', p.textMuted, p.surface],
    ['muted on surfaceAlt', p.textMuted, p.surfaceAlt],
    ['onPrimary on primary', p.onPrimary, p.primary],
    ['onDanger on danger', p.onDanger, p.danger],
    ['primary on background (links)', p.primary, p.background],
    ['primary on surface (links)', p.primary, p.surface],
    ['danger on background', p.danger, p.background],
    ['danger on surface', p.danger, p.surface],
  ];
  for (const band of BAND_ORDER) {
    pairs.push([`${band}: onSolid on solid`, p.band[band].onSolid, p.band[band].solid]);
    pairs.push([`${band}: onSoft on soft`, p.band[band].onSoft, p.band[band].soft]);
  }
  return pairs;
}

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s palette: WCAG AA text contrast', (_name, palette) => {
  it.each(textPairs(palette))('%s ≥ 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
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

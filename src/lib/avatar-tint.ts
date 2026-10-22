import type { Palette } from './theme';

/** A handful of the app's own tokens (never an invented palette) cycled by name, so a list of
 * avatar-less people reads as distinct individuals at a glance instead of one repeated brand-blue
 * circle. Shared by the Manager's Issues table and the Client's Feedback tab. */
export function avatarTint(theme: Palette, name: string): string {
  const palette = [theme.primary, theme.accent, theme.band.green.solid, theme.band.amber.solid, theme.danger];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length] ?? theme.primary;
}

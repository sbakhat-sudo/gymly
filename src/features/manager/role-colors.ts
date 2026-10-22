import type { Palette } from '@/lib/theme';

// Fixed per-role fills (not theme primary/accent): purple for Coach, the brand's own orange-red for
// Client (already AA-tested against white as `onAccent`, so Client reuses it instead of a new ad-hoc
// colour) — shared between PeopleScreen and RequestsScreen so a role reads the same colour everywhere
// in the Manager's app.
export const COACH_COLOR = '#7C4DFF';
export const COACH_ON_COLOR = '#FFFFFF';

export function roleColor(role: 'coach' | 'client', theme: Palette): { bg: string; on: string } {
  return role === 'coach' ? { bg: COACH_COLOR, on: COACH_ON_COLOR } : { bg: theme.accent, on: theme.onAccent };
}

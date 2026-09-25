import type { Band } from '@/schemas';

import { parseTime } from './time';

/** Silent hours: no notification of any kind between 22:00 and 08:00 (spec §7). */
export const QUIET_START_MIN = 22 * 60;
export const QUIET_END_MIN = 8 * 60;

export function isQuietHour(minutes: number): boolean {
  return minutes >= QUIET_START_MIN || minutes < QUIET_END_MIN;
}

export interface AlertWindow {
  from: string;
  to: string;
}

/** Windows offered in Settings. All end before the 22:00 quiet hours. */
export const ALERT_PRESETS = {
  morning: { from: '06:00', to: '09:00' },
  lunch: { from: '12:00', to: '15:00' },
  evening: { from: '17:00', to: '21:00' },
} as const satisfies Record<string, AlertWindow>;

export type AlertPreset = keyof typeof ALERT_PRESETS;
export const DEFAULT_ALERT_PRESET: AlertPreset = 'evening';

/** The preset matching a stored window, if any. */
export function presetOf(window: AlertWindow): AlertPreset | null {
  const entry = (Object.entries(ALERT_PRESETS) as [AlertPreset, AlertWindow][]).find(
    ([, w]) => w.from === window.from && w.to === window.to
  );
  return entry ? entry[0] : null;
}

/** A window is valid when it does not cross midnight and has positive length. */
export function isValidAlertWindow(w: AlertWindow): boolean {
  try {
    return parseTime(w.from) < parseTime(w.to) && parseTime(w.to) <= 24 * 60;
  } catch {
    return false;
  }
}

export interface GreenAlertInput {
  optedIn: boolean;
  band: Band;
  /** Site-local wall clock. */
  localMinutes: number;
  localDateKey: string;
  window: AlertWindow;
  /** Local date (`YYYY-MM-DD`) of the last alert that was sent, if any. */
  lastAlertDateKey: string | undefined;
}

/**
 * Green alert policy (spec §7): only when the member opted in, the site is green *now*,
 * inside the window they chose, outside quiet hours, and at most once per day.
 */
export function shouldSendGreenAlert(i: GreenAlertInput): boolean {
  if (!i.optedIn || i.band !== 'green') return false;
  if (!isValidAlertWindow(i.window)) return false;
  if (isQuietHour(i.localMinutes)) return false;
  if (i.localMinutes < parseTime(i.window.from) || i.localMinutes >= parseTime(i.window.to)) return false;
  return i.lastAlertDateKey !== i.localDateKey;
}

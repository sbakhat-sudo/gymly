import { isQuietHour, isValidAlertWindow, shouldSendGreenAlert, type GreenAlertInput } from '../alerts';

const base: GreenAlertInput = {
  optedIn: true,
  band: 'green',
  localMinutes: 17 * 60 + 30,
  localDateKey: '2026-09-21',
  window: { from: '17:00', to: '21:00' },
  lastAlertDateKey: undefined,
};
const with_ = (patch: Partial<GreenAlertInput>): GreenAlertInput => ({ ...base, ...patch });

describe('shouldSendGreenAlert (spec §7)', () => {
  it('sends when opted in, green now, inside the window, not yet sent today', () => {
    expect(shouldSendGreenAlert(base)).toBe(true);
  });

  it('never without opt-in', () => {
    expect(shouldSendGreenAlert(with_({ optedIn: false }))).toBe(false);
  });

  it('only when the gym is green right now', () => {
    expect(shouldSendGreenAlert(with_({ band: 'amber' }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ band: 'red' }))).toBe(false);
  });

  it('only inside the chosen window (start inclusive, end exclusive)', () => {
    expect(shouldSendGreenAlert(with_({ localMinutes: 17 * 60 }))).toBe(true);
    expect(shouldSendGreenAlert(with_({ localMinutes: 16 * 60 + 59 }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ localMinutes: 21 * 60 - 1 }))).toBe(true);
    expect(shouldSendGreenAlert(with_({ localMinutes: 21 * 60 }))).toBe(false);
  });

  it('at most once per local day, again the next day', () => {
    expect(shouldSendGreenAlert(with_({ lastAlertDateKey: '2026-09-21' }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ lastAlertDateKey: '2026-09-20' }))).toBe(true);
  });

  it('quiet hours 22:00–08:00 always win, even if the chosen window includes them', () => {
    const wide = { from: '06:00', to: '23:30' };
    expect(shouldSendGreenAlert(with_({ window: wide, localMinutes: 22 * 60 }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ window: wide, localMinutes: 23 * 60 }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ window: wide, localMinutes: 7 * 60 + 59 }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ window: wide, localMinutes: 8 * 60 }))).toBe(true);
    expect(shouldSendGreenAlert(with_({ window: wide, localMinutes: 21 * 60 + 59 }))).toBe(true);
  });

  it('a malformed window sends nothing', () => {
    expect(shouldSendGreenAlert(with_({ window: { from: '21:00', to: '17:00' } }))).toBe(false);
    expect(shouldSendGreenAlert(with_({ window: { from: 'xx', to: '17:00' } }))).toBe(false);
  });
});

describe('quiet hours / window validation', () => {
  it('isQuietHour boundaries', () => {
    expect(isQuietHour(0)).toBe(true);
    expect(isQuietHour(8 * 60 - 1)).toBe(true);
    expect(isQuietHour(8 * 60)).toBe(false);
    expect(isQuietHour(22 * 60 - 1)).toBe(false);
    expect(isQuietHour(22 * 60)).toBe(true);
  });

  it('a valid window has positive length and does not cross midnight', () => {
    expect(isValidAlertWindow({ from: '17:00', to: '21:00' })).toBe(true);
    expect(isValidAlertWindow({ from: '17:00', to: '17:00' })).toBe(false);
    expect(isValidAlertWindow({ from: '22:00', to: '06:00' })).toBe(false);
  });
});

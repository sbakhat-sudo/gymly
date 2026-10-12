/**
 * Render tests of the real screens against the real MockApi (fixed clock, no timers faked).
 * They cover what unit tests of pure functions cannot: that each screen renders, wires the data layer,
 * shows the right state for each scenario of the spec, and never shows a people count.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CheckInScreen } from '@/features/checkin/CheckInScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { SettingsScreen } from '@/features/impostazioni/SettingsScreen';
import { ScheduleScreen } from '@/features/orari/ScheduleScreen';
import { PointsScreen } from '@/features/punti/PointsScreen';
import { RedemptionScreen } from '@/features/punti/RedemptionScreen';
import type { BootState } from '@/lib/app-state';
import { AppProviders } from '@/lib/app-providers';
import { createAdjustableClock } from '@/lib/clock';
import { createMockApi } from '@/lib/api/mock-api';
import type { Services } from '@/lib/services';
import { storage } from '@/lib/storage';

jest.setTimeout(20_000); // the first render of a suite is slow (module loading)

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useIsFocused: () => true,
}));

let mockUuid = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}`,
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + mockUuid) & 0xff),
}));

const MONDAY_1830 = new Date('2026-09-21T16:30:00Z'); // 18:30 in Rome, evening peak
const MONDAY_0300 = new Date('2026-09-21T01:00:00Z'); // 03:00 in Rome, closed
const A = 'st_demo_centro';
const B = 'st_demo_riviera';
const C = 'st_demo_collina';

function fakeRandom(seed: number): (n: number) => Uint8Array {
  let a = seed;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      out[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
    }
    return out;
  };
}

interface Options {
  siteId?: string | null;
  memberSiteId?: string | null;
  lang?: 'it' | 'en';
  now?: Date;
  sessionCount?: number;
  themePref?: 'auto' | 'light' | 'dark';
}

function makeServices(o: Options): Services {
  const clock = createAdjustableClock({ now: () => o.now ?? MONDAY_1830 });
  const { api, demo } = createMockApi({ clock, randomBytes: fakeRandom(5), initialLinkedSiteId: o.memberSiteId ?? null });
  return { api, demo, clock };
}

// Same component the real app renders (src/app/_layout.tsx) — a provider missing, removed or
// reordered here would fail both at once, instead of only failing in production (see
// src/app/__tests__/root-layout.test.tsx for the incident this closes).
function tree(services: Services, o: Options, ui: ReactNode) {
  const boot: BootState = {
    lang: o.lang ?? 'it',
    siteId: o.siteId === undefined ? null : o.siteId,
    memberSiteId: o.memberSiteId ?? null,
    sessionCount: o.sessionCount ?? 1,
    themePref: o.themePref ?? 'auto',
    guest: false,
  };
  return (
    <AppProviders
      initial={boot}
      createAppServices={() => services}
      initialSafeAreaMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      {ui}
    </AppProviders>
  );
}

async function show(ui: ReactNode, o: Options = {}): Promise<Services> {
  const services = makeServices(o);
  await render(tree(services, o, ui));
  return services;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockPush.mockClear();
  mockBack.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

/** The hero card is identified by its accessible label ("Affollata. Molto affollata adesso"): the word also appears in zone rows. */
const hero = (label: string) => screen.findByLabelText(label);
const RED_HERO = 'Affollata. Molto affollata adesso';

/** No screen may ever display a people count. */
function expectNoPeopleCount(): void {
  expect(screen.queryByText(/\b\d+\s*(persone|people)\b/i)).toBeNull();
}

describe('Home', () => {
  it('first launch: pick a gym, then see the band — with no permission prompt and no sign-up', async () => {
    const user = userEvent.setup();
    await show(<HomeScreen />, { siteId: null });

    expect(await screen.findByText('Scegli la tua palestra')).toBeTruthy();
    await user.press(await screen.findByRole('button', { name: 'Scegli Gymly Demo · Centro' }));

    // Tier 0, exits, peak time → red, high confidence: label "Affollata" (text, not only colour), no "~".
    expect(await hero(RED_HERO)).toBeTruthy();
    expect(screen.getByText('Gymly Demo · Centro')).toBeTruthy();
    expect(screen.queryByText('~Affollata')).toBeNull();
    expect(screen.getByText('Sala pesi')).toBeTruthy();
    expect(screen.getByText('Cardio')).toBeTruthy();
    expect(screen.getByText(/aggiornato \d+ second[oi] fa/)).toBeTruthy();
    expect(screen.getByText(/accuratezza ±2%/)).toBeTruthy();
    expect(screen.getByText(/Prossima finestra libera: \d\d:\d\d–\d\d:\d\d/)).toBeTruthy();
    expectNoPeopleCount();
  });

  it('remembers the chosen gym choice in storage and shows the "Chiusa ora" state outside opening hours', async () => {
    await storage.set('siteId', A);
    await show(<HomeScreen />, { siteId: A, now: MONDAY_0300 });
    expect(await screen.findByText('Chiusa ora')).toBeTruthy();
    expect(screen.getByText(/Riapre oggi alle 06:00/)).toBeTruthy();
  });

  it('medium confidence: band shown with "~" and an approximate-estimate legend', async () => {
    const services = makeServices({ siteId: B });
    services.demo?.setScenario({ confidence: 'medium', band: 'amber' });
    await render(tree(services, { siteId: B }, <HomeScreen />));
    expect(await screen.findByText('~Moderata')).toBeTruthy();
    expect(screen.getByText('~ = stima approssimativa')).toBeTruthy();
  });

  it('low confidence: the band is hidden and the forecast is shown, labelled as forecast', async () => {
    const services = makeServices({ siteId: A });
    services.demo?.setScenario({ confidence: 'low', band: 'red' });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    expect(await screen.findByText('Dato poco affidabile')).toBeTruthy();
    expect(await screen.findByText(/previsione: Affollata/i)).toBeTruthy();
    expect(screen.queryByText('Affollata')).toBeNull(); // never presented as the live reading
    expect(screen.queryByText('Sala pesi')).toBeNull(); // zones are hidden too
  });

  it('unavailable (adapter down): "Dato non disponibile" plus a clearly labelled forecast', async () => {
    const services = makeServices({ siteId: A });
    services.demo?.setScenario({ adapterDown: true });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    expect(await screen.findByText('Dato non disponibile')).toBeTruthy();
    expect(await screen.findByText(/previsione: /i)).toBeTruthy();
    expect(screen.queryByText(/aggiornato/)).toBeNull();
  });

  it('a corrupt response is discarded by validation and never rendered', async () => {
    const services = makeServices({ siteId: A });
    services.demo?.setScenario({ corruptPayload: true });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    expect(await screen.findByText('Dato non disponibile')).toBeTruthy();
    expect(screen.queryByText('purple')).toBeNull();
  });

  it('stale data (older than the site limit) is dimmed and explicitly labelled, never shown as live', async () => {
    const services = makeServices({ siteId: A });
    services.demo?.setScenario({ staleSeconds: 600 });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    expect(await screen.findByText('Non aggiornato')).toBeTruthy();
    expect(screen.getByText(/Ultimo dato di 10 minuti fa/)).toBeTruthy();
    expect(screen.getByText(/Ultima fascia nota:/)).toBeTruthy();
  });

  it('offline: keeps showing the last cached payload with an explicit "Offline" notice', async () => {
    const services = makeServices({ siteId: A });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    expect(await hero(RED_HERO)).toBeTruthy();
    await waitFor(async () => expect(await storage.get('cachedOccupancy')).toBeDefined());

    // The device goes offline: the Demo panel flips the switch and the screen refetches by itself.
    await act(async () => services.demo?.setScenario({ offline: true }));
    expect(await screen.findByText('Offline')).toBeTruthy();
    expect(screen.getByText('Nessuna connessione: mostriamo l’ultimo dato ricevuto.')).toBeTruthy();
    expect(screen.getByLabelText(RED_HERO)).toBeTruthy();
  });

  it('offline with no cached payload: says so and falls back to the forecast', async () => {
    const services = makeServices({ siteId: A });
    await render(tree(services, { siteId: A }, <HomeScreen />));
    await hero(RED_HERO);
    await storage.remove('cachedOccupancy');

    await act(async () => services.demo?.setScenario({ offline: true }));
    expect(await screen.findByText('Dato non disponibile')).toBeTruthy();
    expect(screen.getByText('Sei offline e non c’è un dato recente. Ti mostriamo la previsione.')).toBeTruthy();
    expect(await screen.findByText(/previsione: /i)).toBeTruthy();
  });

  it('English UI', async () => {
    await show(<HomeScreen />, { siteId: A, lang: 'en' });
    expect(await hero('Crowded. Very busy right now')).toBeTruthy();
    expect(screen.getByText(/updated \d+ seconds? ago/)).toBeTruthy();
    expect(screen.getByText(/Next quiet window/)).toBeTruthy();
  });

  it('shows the points chip only when the member is linked', async () => {
    await show(<HomeScreen />, { siteId: A });
    await hero(RED_HERO);
    expect(screen.queryByLabelText('Hai 330 punti. Apri la sezione Punti')).toBeNull();
  });

  it('linked member: chip with the balance', async () => {
    await show(<HomeScreen />, { siteId: A, memberSiteId: A });
    expect(await screen.findByLabelText('Hai 330 punti. Apri la sezione Punti')).toBeTruthy();
  });

  it('a gym without zones shows no zone card (site B)', async () => {
    await show(<HomeScreen />, { siteId: B });
    await screen.findAllByText(/Affollata|Moderata|Libera/);
    expect(screen.queryByText('Per zona')).toBeNull();
  });
});

describe('Check-in', () => {
  it('checking in switches the button to CHECK-OUT with an elapsed timer; checking out reverts it', async () => {
    const user = userEvent.setup();
    await show(<CheckInScreen />, { siteId: A });

    await user.press(await screen.findByRole('button', { name: 'Fai check-in in Gymly Demo · Centro' }));
    expect(await screen.findByText('CHECK-OUT')).toBeTruthy();
    expect(screen.getByText('In palestra da')).toBeTruthy();
    expectNoPeopleCount();

    await user.press(screen.getByRole('button', { name: 'Fai check-out da Gymly Demo · Centro' }));
    expect(await screen.findByText('CHECK-IN')).toBeTruthy();
    expect(screen.queryByText('In palestra da')).toBeNull();
  });

  it('after 90 minutes, asks "sei ancora in palestra?"; confirming keeps the check-in going', async () => {
    const user = userEvent.setup();
    const services = await show(<CheckInScreen />, { siteId: A });
    await user.press(await screen.findByRole('button', { name: 'Fai check-in in Gymly Demo · Centro' }));
    await screen.findByText('CHECK-OUT');

    await act(async () => services.clock.setOffsetMs(91 * 60_000));
    expect(await screen.findByText('Sei ancora in palestra?')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Sì, sono ancora qui' }));
    await waitFor(() => expect(screen.queryByText('Sei ancora in palestra?')).toBeNull());
    expect(screen.getByText('CHECK-OUT')).toBeTruthy();
  });

  it('auto checks out 105 minutes after check-in when the "sei ancora qui?" prompt is never answered', async () => {
    const user = userEvent.setup();
    const services = await show(<CheckInScreen />, { siteId: A });
    await user.press(await screen.findByRole('button', { name: 'Fai check-in in Gymly Demo · Centro' }));
    await screen.findByText('CHECK-OUT');

    await act(async () => services.clock.setOffsetMs(106 * 60_000));
    expect(await screen.findByText('CHECK-IN')).toBeTruthy();
    expect(await screen.findByText(/Check-out automatico/)).toBeTruthy();
  });
});

describe('Schedule', () => {
  it('renders the day card, its legend, the free windows and the forecast note', async () => {
    await show(<ScheduleScreen />, { siteId: A });
    expect(await screen.findByText('Storico')).toBeTruthy();
    expect(await screen.findByText('Affluenza registrata')).toBeTruthy();
    expect(screen.getByText('Fasce libere · lunedì')).toBeTruthy();
    for (const band of ['Libera', 'Moderata', 'Affollata']) expect(screen.getAllByText(band).length).toBeGreaterThan(0);
    expect(screen.getByText(/ultimi 8 giorni simili/)).toBeTruthy();
  });

  it('tapping a day shows that day\'s free windows', async () => {
    // Storico only opens days before "today" — Friday here so Wed (tapped) and Thu (the default,
    // "yesterday") are both valid past days within the same fixed Mon–Sun strip.
    const FRIDAY_1830 = new Date('2026-09-25T16:30:00Z');
    const user = userEvent.setup();
    await show(<ScheduleScreen />, { siteId: A, now: FRIDAY_1830 });
    await user.press(await screen.findByRole('button', { name: 'Mostra il dettaglio di mercoledì' }));
    expect(await screen.findByText('Fasce libere · mercoledì')).toBeTruthy();
  });

  it('a linked member sees the personal suggestion (spec §7 example format)', async () => {
    await show(<ScheduleScreen />, { siteId: A, memberSiteId: A });
    expect(await screen.findByText(/Di solito vieni martedì alle 18:30\. Alle \d\d:\d\d c’è il \d+% di gente in meno\./)).toBeTruthy();
  });

  it('an anonymous member gets no personal suggestion', async () => {
    await show(<ScheduleScreen />, { siteId: A });
    await screen.findByText('Fasce libere · lunedì');
    expect(screen.queryByText('Per te')).toBeNull();
  });
});

describe('Points', () => {
  it('a gym without named access control says points are unavailable (capability check)', async () => {
    await show(<PointsScreen />, { siteId: C });
    expect(await screen.findByText('I punti non sono disponibili in questa palestra')).toBeTruthy();
    expect(screen.queryByText('Collega la tua tessera')).toBeNull();
  });

  it('anonymous member: invitation to link, no points shown', async () => {
    await show(<PointsScreen />, { siteId: A });
    expect(await screen.findByText('Collega la tua tessera')).toBeTruthy();
    expect(screen.queryByText('Il tuo saldo')).toBeNull();
  });

  it('link with a fictional code (no camera, no permission) → balance, explicit rules, rewards', async () => {
    const user = userEvent.setup();
    await show(<PointsScreen />, { siteId: A });
    await user.type(await screen.findByLabelText('Codice tessera'), 'demo1234');
    await user.press(screen.getByRole('button', { name: 'Collega la tessera' }));

    // The big hero digit shows the bare number (design: number + a separate "Il tuo saldo" label), a11y label still says "330 punti".
    expect(await screen.findByLabelText('330 punti')).toBeTruthy();
    expect(screen.getByText('330')).toBeTruthy();
    // The five rules of the spec, spelled out, with the peak explicitly worth 0.
    expect(screen.getByLabelText('Lun–Ven · 06:00–09:00: 30 punti')).toBeTruthy();
    expect(screen.getByLabelText('Lun–Ven · 14:00–17:00: 50 punti')).toBeTruthy();
    expect(screen.getByLabelText('Lun–Ven · 21:00–chiusura: 50 punti')).toBeTruthy();
    expect(screen.getByLabelText('Sab–Dom · qualsiasi orario: 20 punti')).toBeTruthy();
    expect(screen.getByLabelText('Lun–Ven · 18:00–20:00 (ore di punta): 0 punti')).toBeTruthy();
    expect(screen.getByText('Se entri adesso: nessun punto (ora di punta o fuori fascia)')).toBeTruthy(); // Monday 18:30 = peak
    expect(screen.getByText('Seduta di PT in fascia libera')).toBeTruthy();
    expect(screen.getAllByText(/Esaurito/).length).toBeGreaterThan(0);
    expect(screen.getByText('I premi sono servizi della palestra, non denaro.')).toBeTruthy();
  });

  it('rejects a malformed card code with a clear message and does not link', async () => {
    const user = userEvent.setup();
    await show(<PointsScreen />, { siteId: A });
    await user.type(await screen.findByLabelText('Codice tessera'), 'ab');
    await user.press(screen.getByRole('button', { name: 'Collega la tessera' }));
    expect(await screen.findByText('Codice non valido: usa da 6 a 12 lettere o numeri.')).toBeTruthy();
    expect(screen.queryByText('Il tuo saldo')).toBeNull();
  });

  it('redeeming creates a code and opens the full-screen redemption; points are held', async () => {
    const user = userEvent.setup();
    const services = await show(<PointsScreen />, { siteId: A, memberSiteId: A });
    await user.press(await screen.findByRole('button', { name: 'Riscatta Pass ospite (1 ingresso) per 120 punti' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    const call = mockPush.mock.calls[0]?.[0] as { pathname: string; params: { id: string } };
    expect(call.pathname).toBe('/redemption/[id]');
    expect(call.params.id).toMatch(/^rd_[0-9a-f]{12}$/);
    expect((await services.api.getPoints()).balance).toBe(210);
    expect(await screen.findByLabelText('210 punti')).toBeTruthy();
  });

  it('cannot redeem what it cannot afford or what is out of stock', async () => {
    await show(<PointsScreen />, { siteId: A, memberSiteId: A });
    const discount = await screen.findByRole('button', { name: 'Riscatta Sconto sul mese successivo per 450 punti' });
    expect(discount.props.accessibilityState?.disabled ?? discount.props['aria-disabled']).toBeTruthy();
    const towel = screen.getByRole('button', { name: 'Riscatta Asciugamano Gymly per 60 punti' });
    expect(towel.props.accessibilityState?.disabled ?? towel.props['aria-disabled']).toBeTruthy();
  });

  it('ledger movements carry an explicit sign (not colour only)', async () => {
    await show(<PointsScreen />, { siteId: A, memberSiteId: A });
    await screen.findByLabelText('330 punti');
    expect(screen.getAllByText('+50').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visita fuori picco').length).toBeGreaterThan(0);
  });
});

describe('Redemption screen', () => {
  async function withRedemption(): Promise<{ id: string; code: string }> {
    const services = makeServices({ siteId: A, memberSiteId: A });
    const r = await services.api.createRedemption('rw_guest', 'idem-key-0001');
    await render(tree(services, { siteId: A, memberSiteId: A }, <RedemptionScreen id={r.id} />));
    return { id: r.id, code: r.code };
  }

  it('shows a large QR plus the 6-character code for a pending redemption', async () => {
    const { code } = await withRedemption();
    expect(await screen.findByLabelText(`Codice: ${code.split('').join(' ')}`)).toBeTruthy();
    expect(screen.getByLabelText(`Codice di riscatto, codice ${code.split('').join(' ')}`.replace('Codice di riscatto, ', 'QR code del riscatto, '))).toBeTruthy();
    expect(screen.getByText('Mostra questo QR alla reception, oppure comunica il codice a voce.')).toBeTruthy();
    expect(screen.getByText('In attesa di validazione')).toBeTruthy();
  });

  it('rejects malformed ids from outside the app (deep-link safety)', async () => {
    await show(<RedemptionScreen id="../../etc/passwd" />, { siteId: A, memberSiteId: A });
    expect(await screen.findByText('Codice non trovato')).toBeTruthy();
  });

  it('an unknown but well-formed id is "not found"', async () => {
    await show(<RedemptionScreen id="rd_000000000000" />, { siteId: A, memberSiteId: A });
    expect(await screen.findByText('Codice non trovato')).toBeTruthy();
  });

  it('a validated code is not shown as scannable any more', async () => {
    const services = makeServices({ siteId: A, memberSiteId: A });
    const r = await services.api.createRedemption('rw_guest', 'idem-key-0001');
    await services.demo?.validateRedemption(r.id);
    await render(tree(services, { siteId: A, memberSiteId: A }, <RedemptionScreen id={r.id} />));
    expect(await screen.findByText('Questo codice è già stato utilizzato.')).toBeTruthy();
    expect(screen.queryByLabelText(`Codice: ${r.code.split('').join(' ')}`)).toBeNull();
  });
});

describe('Settings', () => {
  it('lists the three gyms with the current one selected', async () => {
    await show(<SettingsScreen />, { siteId: B });
    expect(await screen.findByRole('radio', { name: 'Gymly Demo · Riviera, selezionata' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Gymly Demo · Centro' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Gymly Demo · Collina' })).toBeTruthy();
  });

  it('switches language to English immediately', async () => {
    const user = userEvent.setup();
    await show(<SettingsScreen />, { siteId: A });
    await user.press(await screen.findByRole('radio', { name: 'English' }));
    expect(await screen.findByText('Delete my data')).toBeTruthy();
    expect(await storage.get('lang')).toBe('en');
  });

  it('alerts cannot be enabled on the first session, and the app asks for no permission', async () => {
    await show(<SettingsScreen />, { siteId: A, sessionCount: 1 });
    expect(await screen.findByText('Disponibile dalla prossima apertura dell’app, dopo che avrai visto l’affluenza.')).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Avvisami quando è libera' });
    expect(toggle.props.disabled ?? toggle.props.accessibilityState?.disabled).toBeTruthy();
  });

  it('second session but no value seen yet: still locked', async () => {
    await show(<SettingsScreen />, { siteId: A, sessionCount: 2 });
    expect(await screen.findByText(/Disponibile dalla prossima apertura/)).toBeTruthy();
  });

  it('second session after seeing a band: the toggle is offered', async () => {
    await storage.set('valueSeen', true);
    await show(<SettingsScreen />, { siteId: A, sessionCount: 2 });
    await screen.findByText('Avvisi “palestra libera”');
    await waitFor(() => expect(screen.queryByText(/Disponibile dalla prossima apertura/)).toBeNull());
  });

  it('"Cancella i miei dati" asks for explicit confirmation, then really wipes storage', async () => {
    const user = userEvent.setup();
    await storage.set('siteId', A);
    await storage.set('memberSiteId', A);
    await storage.set('lang', 'it');
    await show(<SettingsScreen />, { siteId: A, memberSiteId: A });

    await user.press(await screen.findByRole('button', { name: 'Cancella i miei dati' }));
    expect(await screen.findByText('Cancellare i dati su questo dispositivo?')).toBeTruthy();
    // Cancelling changes nothing.
    await user.press(screen.getByRole('button', { name: 'Annulla' }));
    expect(await storage.get('siteId')).toBe(A);

    await user.press(screen.getByRole('button', { name: 'Cancella i miei dati' }));
    await user.press(await screen.findByRole('button', { name: 'Sì, cancella tutto' }));

    expect(await screen.findByText('Dati cancellati. L’app è tornata allo stato iniziale.')).toBeTruthy();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('shows the privacy note in Italian and the version', async () => {
    await show(<SettingsScreen />, { siteId: A });
    expect(await screen.findByText(/Per usare Gymly serve un account/)).toBeTruthy();
    expect(screen.getByText(/Versione /)).toBeTruthy();
  });
});

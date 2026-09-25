import type { AdapterClass } from '@/lib/domain/confidence';
import type { OpeningHours, Weekday } from '@/schemas';

/** Everything here is fictional: no real gym, address, person or id. */
export interface MockZone {
  zone_id: string;
  name: string;
  /** Multiplier on the site-wide load: the weights room is busier than cardio. */
  loadFactor: number;
}

export interface MockSiteDef {
  site_id: string;
  name: string;
  address: string;
  timezone: string;
  staleness_limit_s: number;
  opening_hours: OpeningHours[];
  /** Named access control (Tier 0) → points/nudge capability (spec §9.2). */
  points: boolean;
  adapterClass: AdapterClass;
  /** Verified MAPE of the site's estimate, as a fraction. */
  mape: number | null;
  calibrationAgeDays: number;
  capacitySource: 'p95' | 'operator';
  /** Scales the whole daily curve (busier / quieter centre). */
  loadFactor: number;
  zones: MockZone[];
}

export const DEFAULT_ZONES: MockZone[] = [
  { zone_id: 'zn_pesi', name: 'Sala pesi', loadFactor: 1.15 },
  { zone_id: 'zn_cardio', name: 'Cardio', loadFactor: 0.7 },
];

const days = (from: Weekday, to: Weekday, opens: string, closes: string): OpeningHours[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    weekday: (from + i) as Weekday,
    opens_at: opens,
    closes_at: closes,
  }));

export const MOCK_SITES: MockSiteDef[] = [
  {
    // Tier 0, exits available, with zones → "high" confidence, ±2%.
    site_id: 'st_demo_centro',
    name: 'Gymly Demo · Centro',
    address: 'Via dell’Esempio 1 · Città Demo (indirizzo fittizio)',
    timezone: 'Europe/Rome',
    staleness_limit_s: 300,
    opening_hours: [...days(0, 4, '06:00', '23:00'), ...days(5, 5, '08:00', '20:00'), ...days(6, 6, '09:00', '14:00')],
    points: true,
    adapterClass: 'access_control_exits',
    mape: 0.02,
    calibrationAgeDays: 12,
    capacitySource: 'p95',
    loadFactor: 1,
    zones: DEFAULT_ZONES,
  },
  {
    // Tier 0 but entry-only turnstile, no zones → confidence capped at "medium" (~), ±9%.
    site_id: 'st_demo_riviera',
    name: 'Gymly Demo · Riviera',
    address: 'Lungomare di Prova 22 · Città Demo (indirizzo fittizio)',
    timezone: 'Europe/Rome',
    staleness_limit_s: 300,
    opening_hours: [...days(0, 4, '07:00', '22:00'), ...days(5, 5, '09:00', '18:00')],
    points: true,
    adapterClass: 'access_control_entry_only',
    mape: 0.09,
    calibrationAgeDays: 20,
    capacitySource: 'p95',
    loadFactor: 0.85,
    zones: [],
  },
  {
    // Tier 1 (WiFi), no zones → "medium", ±12%, and NO points (no named access control).
    site_id: 'st_demo_collina',
    name: 'Gymly Demo · Collina',
    address: 'Piazza Inventata 5 · Città Demo (indirizzo fittizio)',
    timezone: 'Europe/Rome',
    staleness_limit_s: 300,
    opening_hours: [...days(0, 4, '06:30', '22:30'), ...days(5, 6, '08:00', '19:00')],
    points: false,
    adapterClass: 'wifi',
    mape: 0.12,
    calibrationAgeDays: 30,
    capacitySource: 'p95',
    loadFactor: 0.75,
    zones: [],
  },
];

import { supabase } from './client';

/** A place the `address-suggest` Edge Function found: its readable address and where it is. */
export interface AddressPlace {
  label: string;
  lat: number;
  lng: number;
  /** `true` when it is the building itself; `false` when it is the street, with the typed number put on it. */
  exact: boolean;
}

function isPlace(p: unknown): p is AddressPlace {
  return (
    typeof p === 'object' &&
    p !== null &&
    'label' in p &&
    typeof p.label === 'string' &&
    'lat' in p &&
    typeof p.lat === 'number' &&
    'lng' in p &&
    typeof p.lng === 'number' &&
    'exact' in p &&
    typeof p.exact === 'boolean'
  );
}

/**
 * Places for what is being typed ("via gari" → "Via Garibaldi, Genova" and where it is), asked of the
 * `address-suggest` Edge Function — the app only ever talks to Supabase. Any failure just means no results.
 */
export async function suggestPlaces(query: string): Promise<AddressPlace[]> {
  const { data, error } = await supabase.functions.invoke<{ places?: unknown }>('address-suggest', { body: { query } });
  if (error || !data || !Array.isArray(data.places)) return [];
  return data.places.filter(isPlace).slice(0, 8);
}

/** Just the readable addresses of `suggestPlaces`. */
export async function suggestAddresses(query: string): Promise<string[]> {
  return (await suggestPlaces(query)).map((p) => p.label);
}

/**
 * Where an address is, for the best match (a known building first) — used to pre-fill the gym's latitude/longitude
 * from its saved address. `null` when nothing is found.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; exact: boolean } | null> {
  const [first] = await suggestPlaces(address);
  return first ? { lat: first.lat, lng: first.lng, exact: first.exact } : null;
}

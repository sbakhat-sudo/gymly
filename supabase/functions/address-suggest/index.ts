// Street/address suggestions for the staff profile form and the Manager's gym position: the app never talks to a
// geocoder itself (no network outside Supabase), so this function asks Photon (komoot's OpenStreetMap search, built
// for search-as-you-type) on its behalf. Signed-in callers only; the typed text is the only thing sent, and nothing
// is stored. (Nominatim refuses requests coming from cloud servers with a 403, which is why it is not used.)
//
// The typed house number is kept in the search, so a building that OpenStreetMap knows comes back as its own point
// (`exact: true`). When it does not know the number, the street is returned with the typed number on it and the
// position of the street (`exact: false`).
import { withSupabase } from 'npm:@supabase/server@1';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    osm_key?: string;
    countrycode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
  };
}

// The house number the person typed ("Via Trasta 16" → "16", "12/b", "7a"): up to 4 digits, so a 5-digit postcode is never taken for it.
const NUMBER = /(?:^|[\s,])(\d{1,4}(?:\s?[a-zA-Z](?![a-zA-Z]))?(?:\/\w{1,2})?)(?=[\s,]|$)/g;

function labelOf(feature: PhotonFeature, typedNumber: string | null): string | null {
  const p = feature.properties;
  if (!p || p.countrycode !== 'IT') return null;
  const road = p.street ?? (p.osm_key === 'highway' ? p.name : undefined);
  if (!road) return null;
  const city = p.city ?? p.town ?? p.village ?? p.county;
  const number = p.housenumber ?? typedNumber;
  const street = number ? `${road} ${number}` : road;
  const place = [p.postcode, city].filter(Boolean).join(' ');
  return place ? `${street}, ${place}` : street;
}

async function search(q: string): Promise<PhotonFeature[] | null> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '20');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Gymly/1.0 (address suggestions)' } });
    if (!res.ok) return null;
    return ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  } catch {
    return null;
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (!ctx.userClaims?.id) {
      return Response.json({ message: 'unauthorized' }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: 'invalid body' }, { status: 400 });
    }
    const query = typeof (body as { query?: unknown })?.query === 'string' ? (body as { query: string }).query.trim() : '';
    if (query.length < 4 || query.length > 120) {
      return Response.json({ suggestions: [], places: [] });
    }

    // The last number wins ("via 4 novembre 5" → 5).
    const numberMatch = [...query.matchAll(NUMBER)].pop();
    const typedNumber = numberMatch?.[1]?.replace(/\s+/g, '') ?? null;
    const full = query.replace(/[,\s]+/g, ' ').trim();

    let features = await search(full);
    if (features === null) return Response.json({ suggestions: [], places: [] });
    // The building is unknown to OpenStreetMap: fall back to the street alone, the typed number put on each result.
    if (typedNumber && !features.some((f) => f.properties?.housenumber)) {
      const streetQuery = (numberMatch ? query.slice(0, numberMatch.index) + ' ' + query.slice((numberMatch.index ?? 0) + numberMatch[0].length) : query).replace(/[,\s]+/g, ' ').trim();
      features = (await search(streetQuery)) ?? features;
    }

    // Exact buildings first.
    const ordered = [...features].sort((a, b) => Number(Boolean(b.properties?.housenumber)) - Number(Boolean(a.properties?.housenumber)));

    const seen = new Set<string>();
    const suggestions: string[] = [];
    const places: { label: string; lat: number; lng: number; exact: boolean }[] = [];
    for (const feature of ordered) {
      const label = labelOf(feature, typedNumber);
      if (label && !seen.has(label) && suggestions.length < 8) {
        seen.add(label);
        suggestions.push(label);
        const [lng, lat] = feature.geometry?.coordinates ?? [];
        if (typeof lat === 'number' && typeof lng === 'number') places.push({ label, lat, lng, exact: Boolean(feature.properties?.housenumber) });
      }
    }
    return Response.json({ suggestions, places });
  }),
};

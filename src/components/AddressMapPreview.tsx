import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { radius } from '@/lib/theme';

import { AppText } from './AppText';

/** Settles 600ms after the caller's value stops changing — same debounce used by
 * `ManagerPositionCard.tsx`'s `RadiusPreview`, long enough to type a few more characters without
 * the iframe reloading on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Shared, simplified version of `ManagerPositionCard.tsx`'s `RadiusPreview` — a plain Google Maps
 * `<iframe>` (web only, no API key/JS SDK; the same CLAUDE.md-documented exception), with no radius
 * rings, used anywhere a screen just needs to show "here's roughly where this address is" rather
 * than a full geofence editor. Extracted here once it was needed in two places (Owner's "Aggiungi
 * Manager" modal and "Posizione sede" settings card) instead of a third local copy.
 */
export function AddressMapPreview({ addressQuery, lat, lng, height = 160 }: { addressQuery: string | null; lat: string; lng: string; height?: number }) {
  const { t } = useI18n();
  const latNum = Number(lat);
  const lngNum = Number(lng);
  // `Number('')` is `0`, not `NaN` — without the blank-string check below, an unset lat/lng (the
  // common case: no coordinates typed yet) silently read as real coordinates 0,0 ("Null Island", the
  // Gulf of Guinea), showing open ocean instead of falling back to the typed address.
  const hasCoords = lat.trim() !== '' && lng.trim() !== '' && Number.isFinite(latNum) && Number.isFinite(lngNum);
  const debouncedAddress = useDebounced(addressQuery, 600);
  const mapQuery = hasCoords ? `${latNum},${lngNum}` : debouncedAddress;
  const showMap = Platform.OS === 'web' && mapQuery !== null;

  return (
    <View style={{ height, borderRadius: radius.card, backgroundColor: '#14141a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {showMap ? (
        <iframe
          title={t('owner.managers.add.mapPreview')}
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          loading="lazy"
        />
      ) : (
        <AppText style={{ color: '#9A9AA6', fontSize: 13 }}>{t('owner.managers.add.mapPlaceholder')}</AppText>
      )}
    </View>
  );
}

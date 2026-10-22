import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CrosshairIcon, MapPinIcon, UsersIcon } from '@/components/icons';
import { RangeSlider } from '@/components/RangeSlider';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';

const RADIUS_MIN = 10;
const RADIUS_MAX = 300;
const PREVIEW_SIZE = 220;

/** `Linking.openURL` on web navigates the current tab away, replacing the whole app — same issue
 * already solved once for the WhatsApp invite link in `PeopleScreen.tsx`. This screen only ever
 * renders on web (Manager is a web-only role), so `window.open` is always available: opens real,
 * full Google Maps in a new tab instead, leaving Gymly's own tab untouched. */
function openExternalUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(url);
}

/** The real Google Maps site (not the read-only embed above) — browser-based GPS is often imprecise
 * on a desktop (Wi-Fi/IP positioning, not a real GPS fix), so this is the actual fix for "I need the
 * *exact* spot": open full Google Maps, right-click the precise location, the coordinates are right
 * there to copy, then paste them into the fields below. Centred on the real saved coordinates once
 * they're set; before that, falls back to a search for whatever address has been typed so far, so
 * the link goes somewhere useful even before Latitudine/Longitudine have a real value yet. */
function googleMapsUrl(lat: string, lng: string, addressQuery: string | null): string {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  // `Number('')` is `0`, not `NaN` — without the blank-string check, unset Lat/Lng read as real
  // coordinates 0,0 ("Null Island") instead of falling back to the typed address.
  if (lat.trim() !== '' && lng.trim() !== '' && Number.isFinite(latNum) && Number.isFinite(lngNum)) return `https://www.google.com/maps/@${latNum},${lngNum},18z`;
  if (addressQuery) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
  return 'https://www.google.com/maps';
}

/** Plain text, not yet URL-encoded — the embed preview below resolves this itself (Google's own
 * server geocodes the text when it renders the `q=` query embed, same as it does for `q=lat,lng`;
 * nothing is looked up from this app's own JS). `null` once street+number+city is empty, so the
 * preview can fall back to the abstract diagram instead of embedding a blank query. */
function addressLine(street: string, number: string, city: string): string | null {
  const line1 = [street.trim(), number.trim()].filter(Boolean).join(' ');
  const query = [line1, city.trim()].filter(Boolean).join(', ');
  return query || null;
}

/** Closer zoom for a tight geofence, wider for a large one — purely cosmetic framing, never fed back
 * into the actual radius value that's saved. */
function zoomForRadius(radiusM: number): number {
  if (radiusM <= 50) return 18;
  if (radiusM <= 100) return 17;
  if (radiusM <= 200) return 16;
  return 15;
}

/** Settles 600ms after the caller's value stops changing — long enough to type a few more
 * characters without the iframe reloading on every keystroke, short enough that it still feels
 * "live" once typing pauses. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * A real Google Maps embed (web only) — a deliberate, explicit exception to CLAUDE.md's "only
 * Supabase" network boundary (documented there), approved specifically for this one card: the
 * Manager's own, already-public gym address, loaded via a plain `<iframe>` (the browser fetches it
 * directly; no `fetch`/XHR/SDK call from this app's own JS). Centres on the real saved coordinates
 * once they're set; before that, centres on whatever street/number/city has been typed so far
 * (debounced — see `useDebounced`), so the preview updates live while filling in the address fields
 * instead of needing a separate "search" tap. Falls back to an abstract radius diagram — concentric
 * rings scaled to the slider value, a pin, raw coordinates as text — once there's neither (nothing to
 * centre a map on) or on native (Manager never actually runs there; `_layout.tsx` redirects a native
 * Manager to `web-only`, so this is a safety net, not an expected path).
 */
function RadiusPreview({ lat, lng, radiusM, addressQuery }: { lat: string; lng: string; radiusM: number; addressQuery: string | null }) {
  const { t } = useI18n();
  const theme = useTheme();
  const clampedRadius = Math.min(Math.max(radiusM, RADIUS_MIN), RADIUS_MAX);
  const outerSize = 40 + (clampedRadius / RADIUS_MAX) * (PREVIEW_SIZE - 40);
  const midSize = outerSize * 0.66;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  // `Number('')` is `0`, not `NaN` — without the blank-string check, unset Lat/Lng read as real
  // coordinates 0,0 ("Null Island", open ocean) instead of falling back to the typed address.
  const hasCoords = lat.trim() !== '' && lng.trim() !== '' && Number.isFinite(latNum) && Number.isFinite(lngNum);
  const coordsLabel = hasCoords ? `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}` : '—';
  const debouncedAddress = useDebounced(addressQuery, 600);
  const mapQuery = hasCoords ? `${latNum},${lngNum}` : debouncedAddress;
  const showMap = Platform.OS === 'web' && mapQuery !== null;

  return (
    <View style={{ flex: 1, minWidth: 220, minHeight: PREVIEW_SIZE + 90, borderRadius: radius.card, backgroundColor: '#14141a', overflow: 'hidden' }}>
      {showMap ? (
        <iframe
          title={t('manager.gym.location.previewTitle')}
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${zoomForRadius(clampedRadius)}&output=embed`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          loading="lazy"
        />
      ) : null}

      <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }} pointerEvents="box-none">
        <View
          style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,26,0.75)' }}
          pointerEvents="none">
          <AppText style={{ color: '#E7E7EC', fontWeight: '700', fontSize: 13 }}>{t('manager.gym.location.previewTitle')}</AppText>
        </View>

        {!showMap ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <View style={{ width: outerSize, height: outerSize, borderRadius: outerSize / 2, backgroundColor: 'rgba(99,122,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: midSize, height: midSize, borderRadius: midSize / 2, backgroundColor: 'rgba(99,122,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: theme.danger, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="none">
          <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,26,0.75)' }}>
            <AppText style={{ color: '#E7E7EC', fontFamily: fontFamily.mono, fontSize: 11 }} numberOfLines={1}>
              {coordsLabel}
            </AppText>
          </View>
          <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,26,0.75)' }}>
            <AppText style={{ color: '#E7E7EC', fontSize: 11, fontWeight: '700' }}>{Math.round(clampedRadius)}m</AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

interface ManagerPositionCardProps {
  lat: string;
  onLatChange: (v: string) => void;
  lng: string;
  onLngChange: (v: string) => void;
  radiusM: string;
  onRadiusChange: (v: string) => void;
  accuracyM: number | null;
  gpsAvailable: boolean | null;
  clientsPresent: number | null;
  locating: boolean;
  saving: boolean;
  onLocateMe: () => void;
  onSave: () => void;
  feedback: 'saved' | 'invalid' | 'error' | 'permissionDenied' | null;
}

/** "Posizione palestra": the geofence the Manager sets for geolocated check-in, as one card — a
 * schematic radius preview (left), and the live fields/stats (right): lat/lng, a drag slider for the
 * radius instead of typing metres, real GPS accuracy from the last "Usa la mia posizione" fix, and
 * how many clients are currently checked in (the only real, honest stand-in for "how many clients
 * are inside this radius right now" — this app never tracks anyone's live position continuously,
 * only at the moment of check-in, so "entro raggio" is read as "already passed the geofence check",
 * not a live headcount). */
export function ManagerPositionCard({
  lat,
  onLatChange,
  lng,
  onLngChange,
  radiusM,
  onRadiusChange,
  accuracyM,
  gpsAvailable,
  clientsPresent,
  locating,
  saving,
  onLocateMe,
  onSave,
  feedback,
}: ManagerPositionCardProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const radiusNum = Number(radiusM) || RADIUS_MIN;
  // Local, ephemeral — only ever used to steer the map preview above live; the coordinates the
  // Manager copies back into the fields below are the real stored values.
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [city, setCity] = useState('');
  const addressQuery = addressLine(street, streetNumber, city);

  const fieldStyle = {
    flex: 1,
    minHeight: MIN_TAP,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
      <RadiusPreview lat={lat} lng={lng} radiusM={radiusNum} addressQuery={addressQuery} />

      <View style={[{ flex: 2, minWidth: 280, borderRadius: radius.card, backgroundColor: theme.surface, padding: spacing.lg, gap: spacing.md }, CARD_SHADOW]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText style={{ fontWeight: '800', fontSize: 20 }}>{t('manager.gym.location.title')}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: theme.band.green.solid }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.band.green.onSolid }} />
            <AppText color={theme.band.green.onSolid} style={{ fontSize: 11, fontWeight: '800' }}>
              {t('manager.gym.location.liveBadge')}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" muted style={{ marginTop: -6 }}>
          {t('manager.gym.location.help')}
        </AppText>

        {Platform.OS === 'web' ? (
          <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
            <AppText style={{ fontWeight: '700', fontSize: 13 }}>{t('manager.gym.location.addressSearch.title')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={[fieldStyle, { flex: 3 }]}>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder={t('manager.gym.location.addressSearch.streetPlaceholder')}
                  accessibilityLabel={t('manager.gym.location.addressSearch.street')}
                  placeholderTextColor={theme.textMuted}
                  style={{ flex: 1, color: theme.text, fontSize: 14 }}
                />
              </View>
              <View style={[fieldStyle, { flex: 1 }]}>
                <TextInput
                  value={streetNumber}
                  onChangeText={setStreetNumber}
                  placeholder={t('manager.gym.location.addressSearch.numberPlaceholder')}
                  accessibilityLabel={t('manager.gym.location.addressSearch.number')}
                  placeholderTextColor={theme.textMuted}
                  style={{ flex: 1, color: theme.text, fontSize: 14 }}
                />
              </View>
            </View>
            <View style={fieldStyle}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder={t('manager.gym.location.addressSearch.cityPlaceholder')}
                accessibilityLabel={t('manager.gym.location.addressSearch.city')}
                placeholderTextColor={theme.textMuted}
                style={{ flex: 1, color: theme.text, fontSize: 14 }}
              />
            </View>
            <AppText variant="caption" muted style={{ fontSize: 11.5, lineHeight: 15 }}>
              {t('manager.gym.location.addressSearch.help')}
            </AppText>
          </View>
        ) : null}

        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.gym.location.lat')}
          </AppText>
          <View style={fieldStyle}>
            <MapPinIcon color={theme.textMuted} size={16} />
            <TextInput
              value={lat}
              onChangeText={onLatChange}
              placeholder="45.4642"
              accessibilityLabel={t('manager.gym.location.lat')}
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: theme.text, fontFamily: fontFamily.mono, fontSize: 15 }}
            />
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.gym.location.lng')}
          </AppText>
          <View style={fieldStyle}>
            <MapPinIcon color={theme.textMuted} size={16} />
            <TextInput
              value={lng}
              onChangeText={onLngChange}
              placeholder="9.1900"
              accessibilityLabel={t('manager.gym.location.lng')}
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: theme.text, fontFamily: fontFamily.mono, fontSize: 15 }}
            />
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <Pressable
            onPress={() => openExternalUrl(googleMapsUrl(lat, lng, addressQuery))}
            accessibilityRole="link"
            accessibilityLabel={t('manager.gym.location.openMaps')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              opacity: pressed ? 0.7 : 1,
            })}>
            <MapPinIcon color={theme.primary} size={14} />
            <AppText color={theme.primary} style={{ fontWeight: '700', fontSize: 12.5 }}>
              {t('manager.gym.location.openMaps')}
            </AppText>
          </Pressable>
        ) : null}

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {t('manager.gym.location.radius')}
            </AppText>
            <AppText style={{ fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] }}>{Math.round(radiusNum)}m</AppText>
          </View>
          {Platform.OS === 'web' ? (
            <RangeSlider
              value={radiusNum}
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={5}
              color={theme.primary}
              accessibilityLabel={t('manager.gym.location.radius')}
              onChange={(v) => onRadiusChange(String(v))}
            />
          ) : (
            <TextInput
              value={radiusM}
              onChangeText={onRadiusChange}
              placeholder="150"
              accessibilityLabel={t('manager.gym.location.radius')}
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              style={{ minHeight: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontFamily: fontFamily.mono, fontSize: 15 }}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: theme.surfaceAlt }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: gpsAvailable ? theme.band.green.solid : theme.textMuted }} />
            <AppText numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600' }}>
              {t(gpsAvailable ? 'manager.gym.location.gpsActive' : 'manager.gym.location.gpsInactive')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CrosshairIcon color={theme.textMuted} size={14} />
            <AppText numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600' }}>
              {accuracyM !== null ? t('manager.gym.location.precision', { n: Math.round(accuracyM) }) : t('manager.gym.location.precisionUnknown')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <UsersIcon color={theme.textMuted} size={14} />
            <AppText numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600' }}>
              {t('manager.gym.location.clientsInRange', { n: clientsPresent ?? 0 })}
            </AppText>
          </View>
        </View>

        {feedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={feedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(
                feedback === 'saved'
                  ? 'manager.gym.location.saved'
                  : feedback === 'invalid'
                    ? 'manager.gym.location.invalid'
                    : feedback === 'permissionDenied'
                      ? 'manager.gym.location.permissionDenied'
                      : 'manager.gym.location.error'
              )}
            </AppText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={onLocateMe}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={t('manager.gym.location.useMine')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: MIN_TAP,
              borderRadius: radius.pill,
              backgroundColor: theme.surfaceAlt,
              opacity: locating ? 0.6 : 1,
            }}>
            <CrosshairIcon color={theme.text} size={16} />
            <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13 }}>
              {t('manager.gym.location.useMine')}
            </AppText>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button label={t('manager.gym.location.save')} onPress={onSave} disabled={saving} />
          </View>
        </View>
      </View>
    </View>
  );
}

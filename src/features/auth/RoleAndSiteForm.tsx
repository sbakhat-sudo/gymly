import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { MapPinIcon } from '@/components/icons';
import { isPlausibleName, isPlausiblePhone } from '@/lib/domain/input-checks';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';

export type Role = 'client' | 'coach';

export const DEFAULT_TIMEZONE = 'Europe/Rome';

interface SiteOption {
  site_id: string;
  name: string;
  address: string | null;
}

export interface RoleAndSiteValues {
  role: Role;
  fullName: string;
  phone: string;
  siteId: string | null;
}

/**
 * State + validation for the role/full-name/gym fields, shared by the signup screen (collected
 * before the account exists) and the post-signup completion screen (fallback for a signup
 * interrupted by email confirmation).
 *
 * Coach/Client only: Manager has its own signup flow entirely (a plan choice, then an Admin
 * approval wait, then a dedicated gym-creation screen post-approval) — see `signup.tsx` and
 * `CreateGymScreen.tsx`.
 *
 * The role is never picked from a list in the UI: the app has one self-serve signup (client).
 * Coach accounts are onboarded through their own dedicated QR code/link, which opens this same
 * screen with the role already fixed — `initialRole` is where that comes in.
 *
 * The gym is found by typing its name: if exactly one gym matches it is selected by itself; when several share
 * the name, they are listed with their address (and a link to see each one on the map) and the member taps theirs.
 */
export function useRoleAndSiteFields(initialRole: Role = 'client') {
  const [role] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sites, setSites] = useState<SiteOption[] | null>(null);
  const [sitesError, setSitesError] = useState(false);
  const [siteQuery, setSiteQueryState] = useState('');
  // The gym tapped in the list when several share the typed name; cleared as soon as the typing changes.
  const [pickedSiteId, setPickedSiteId] = useState<string | null>(null);
  function setSiteQuery(v: string): void {
    setSiteQueryState(v);
    setPickedSiteId(null);
  }
  function pickSite(site: SiteOption): void {
    setSiteQueryState(site.name);
    setPickedSiteId(site.site_id);
  }

  useEffect(() => {
    let alive = true;
    // Reachable before the account exists (the signup screen), so this calls the narrow
    // `list_signup_sites` RPC — open to `anon` — rather than selecting from `sites` directly,
    // which only grants SELECT to `authenticated` (it also holds operational fields that must
    // never reach an unauthenticated client).
    void supabase.rpc('list_signup_sites').then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setSitesError(true);
      else setSites(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const query = siteQuery.trim().toLowerCase();
  const filteredSites = query.length > 0 ? (sites?.filter((s) => s.name.toLowerCase().includes(query)) ?? null) : null;
  const matchedSite = filteredSites?.find((x) => x.site_id === pickedSiteId) ?? (filteredSites && filteredSites.length === 1 ? filteredSites[0] : null) ?? null;
  // A browser's saved-credentials autofill can drop an email address into the name or phone field.
  const nameBad = fullName.trim().length > 0 && !isPlausibleName(fullName);
  const phoneBad = phone.trim().length > 0 && !isPlausiblePhone(phone);

  return {
    role,
    fullName,
    setFullName,
    phone,
    setPhone,
    sites,
    sitesError,
    siteQuery,
    setSiteQuery,
    pickSite,
    filteredSites,
    matchedSite,
    nameBad,
    phoneBad,
    isValid: matchedSite !== null && !nameBad && !phoneBad,
    values: (): RoleAndSiteValues => ({ role, fullName, phone, siteId: matchedSite?.site_id ?? null }),
  };
}

export type RoleAndSiteFieldsState = ReturnType<typeof useRoleAndSiteFields>;

/** Opens the gym's address on the map: a fixed https address with the gym's own name and address as the search text
 * — nothing else is sent. On the web it opens in a new tab so the signup page stays where it is. */
function openOnMap(site: SiteOption): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name} ${site.address ?? ''}`.trim())}`;
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else void Linking.openURL(url);
}

/**
 * A fixed role indicator (never a picker — see `useRoleAndSiteFields`), full name, then a single
 * "type your gym's name" field — no list to tap through: typing enough to match exactly one gym
 * selects it, confirmed inline. Presentational only: no submit button, the caller supplies one
 * alongside its own error state.
 */
export function RoleAndSiteFields({ fields }: { fields: RoleAndSiteFieldsState }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { role, fullName, setFullName, phone, setPhone, sites, sitesError, siteQuery, setSiteQuery, pickSite, filteredSites, matchedSite, nameBad, phoneBad } = fields;

  const inputStyle = {
    minHeight: MIN_TAP + 4,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    color: theme.text,
    backgroundColor: theme.background,
    fontFamily: fontFamily.body,
    fontSize: 16,
  } as const;

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('auth.signup.role')}
        </AppText>
        <AppText style={{ fontWeight: '700', fontSize: 18 }}>{t(`auth.signup.role.${role}`)}</AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('auth.signup.fullName')}
        </AppText>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('auth.signup.fullName')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('auth.signup.fullName')}
          autoComplete="name"
          textContentType="name"
          style={inputStyle}
        />
        {nameBad ? <AppText color={theme.danger} style={{ fontSize: 13, fontWeight: '600' }}>{t('auth.signup.error.invalidName')}</AppText> : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('auth.signup.phone')}
        </AppText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={t('auth.signup.phone')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('auth.signup.phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          style={inputStyle}
        />
        {phoneBad ? <AppText color={theme.danger} style={{ fontSize: 13, fontWeight: '600' }}>{t('auth.signup.error.invalidPhone')}</AppText> : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('auth.signup.site')}
        </AppText>
        {sitesError ? (
          <AppText color={theme.danger}>{t('auth.signup.site.loadError')}</AppText>
        ) : !sites ? (
          <ActivityIndicator />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={siteQuery}
              onChangeText={setSiteQuery}
              placeholder={t('auth.signup.site.placeholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('auth.signup.site')}
              autoCapitalize="words"
              autoCorrect={false}
              style={inputStyle}
            />
            {siteQuery.trim().length === 0 ? null : matchedSite ? (
              <View style={{ gap: 2 }}>
                <AppText style={{ color: theme.primary, fontWeight: '600' }}>{t('auth.signup.site.matched', { name: matchedSite.name })}</AppText>
                {matchedSite.address ? (
                  <AppText variant="caption" muted>
                    {matchedSite.address}
                  </AppText>
                ) : null}
              </View>
            ) : filteredSites && filteredSites.length === 0 ? (
              <AppText variant="caption" muted>
                {t('auth.signup.site.empty')}
              </AppText>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" muted>
                  {t('auth.signup.site.pick')}
                </AppText>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                  <View style={{ gap: spacing.sm }}>
                    {(filteredSites ?? []).map((site) => (
                      <View key={site.site_id} style={{ borderRadius: 16, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.background, overflow: 'hidden' }}>
                        <Pressable onPress={() => pickSite(site)} accessibilityRole="button" accessibilityLabel={`${site.name}, ${site.address ?? ''}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: MIN_TAP, opacity: pressed ? 0.8 : 1 })}>
                          <MapPinIcon color={theme.primary} size={20} />
                          <View style={{ flex: 1, gap: 2 }}>
                            <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>{site.name}</AppText>
                            <AppText muted style={{ fontSize: 13 }}>
                              {site.address ?? t('auth.signup.site.noAddress')}
                            </AppText>
                          </View>
                        </Pressable>
                        {site.address ? (
                          <Pressable
                            onPress={() => openOnMap(site)}
                            accessibilityRole="link"
                            accessibilityLabel={t('auth.signup.site.map')}
                            style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 })}>
                            <AppText style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>{t('auth.signup.site.map')}</AppText>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );
}

/**
 * Attaches a role + gym to an ALREADY authenticated Coach/Client: a `profiles` row, as 'pending' —
 * waiting in that gym's Manager's "Richieste" until approved or rejected. (A Manager can skip this
 * entirely for a specific person via "Aggiungi" in Persone — see manager-api.ts#createMember.)
 */
export async function submitRoleAndSite(v: RoleAndSiteValues): Promise<string | null> {
  if (!v.siteId) return null;
  const { error } = await supabase.rpc('complete_self_registration', {
    p_role: v.role,
    p_site_id: v.siteId,
    p_full_name: v.fullName.trim() || null,
    p_phone: v.phone.trim() || null,
  });
  return error?.message ?? null;
}

/**
 * Fallback screen for the rare case where an interrupted signup left an authenticated session with
 * no role/site yet, and no locally-stored pending choice to replay automatically (e.g. the member
 * confirmed their email on a different device).
 */
export function RoleAndSiteForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const fields = useRoleAndSiteFields();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!fields.isValid) return;
    setBusy(true);
    setError(null);
    const err = await submitRoleAndSite(fields.values());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onDone();
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <RoleAndSiteFields fields={fields} />

      {error ? (
        <View accessibilityLiveRegion="polite">
          <AppText color={theme.danger} style={{ fontWeight: '600' }}>
            {error}
          </AppText>
        </View>
      ) : null}

      <Button label={t('auth.signup.button')} onPress={() => void submit()} disabled={busy || !fields.isValid} />
    </View>
  );
}

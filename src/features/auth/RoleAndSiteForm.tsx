import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
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
 * The gym is never picked from a list either: typing enough of its name to match exactly one of
 * the gyms returned by `list_signup_sites` selects it — no list to tap through.
 */
export function useRoleAndSiteFields(initialRole: Role = 'client') {
  const [role] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState('');
  const [sites, setSites] = useState<SiteOption[] | null>(null);
  const [sitesError, setSitesError] = useState(false);
  const [siteQuery, setSiteQuery] = useState('');

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
  const matchedSite = filteredSites && filteredSites.length === 1 ? filteredSites[0] : null;

  return {
    role,
    fullName,
    setFullName,
    sites,
    sitesError,
    siteQuery,
    setSiteQuery,
    filteredSites,
    matchedSite,
    isValid: matchedSite !== null,
    values: (): RoleAndSiteValues => ({ role, fullName, siteId: matchedSite?.site_id ?? null }),
  };
}

export type RoleAndSiteFieldsState = ReturnType<typeof useRoleAndSiteFields>;

/**
 * A fixed role indicator (never a picker — see `useRoleAndSiteFields`), full name, then a single
 * "type your gym's name" field — no list to tap through: typing enough to match exactly one gym
 * selects it, confirmed inline. Presentational only: no submit button, the caller supplies one
 * alongside its own error state.
 */
export function RoleAndSiteFields({ fields }: { fields: RoleAndSiteFieldsState }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { role, fullName, setFullName, sites, sitesError, siteQuery, setSiteQuery, filteredSites, matchedSite } = fields;

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
              <AppText style={{ color: theme.primary, fontWeight: '600' }}>{t('auth.signup.site.matched', { name: matchedSite.name })}</AppText>
            ) : filteredSites && filteredSites.length === 0 ? (
              <AppText variant="caption" muted>
                {t('auth.signup.site.empty')}
              </AppText>
            ) : (
              <AppText variant="caption" muted>
                {t('auth.signup.site.narrow')}
              </AppText>
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

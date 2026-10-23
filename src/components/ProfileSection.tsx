import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { SettingsBlock, SettingsGroup, settingsInputStyle } from './settings/SettingsKit';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Self-editable "Nome/Cognome" for every role's Impostazioni, plus "Anno di nascita" for Coach and
 * Client only (not the Manager — per the request, the gym's owner account doesn't need it). Writes
 * directly to `profiles` (see `supabase/migrations/20260930010000_profile_details.sql`): the
 * column-level grant there only allows a signed-in user to touch their own first_name/last_name/
 * birth_year, never role/site_id/status.
 *
 * Drawn as a "Profilo" group (see `SettingsKit`): labelled fields in one card with a single Save button.
 */
export function ProfileSection({ includeBirthYear = false }: { includeBirthYear?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();

  const profile = auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? auth.profile : null;
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | 'invalidYear' | null>(null);

  if (!profile || (auth.status !== 'active' && auth.status !== 'admin' && auth.status !== 'owner')) return null;
  const userId = auth.session.user.id;

  const changed =
    firstName.trim() !== (profile.firstName ?? '') ||
    lastName.trim() !== (profile.lastName ?? '') ||
    (includeBirthYear && birthYear.trim() !== (profile.birthYear ? String(profile.birthYear) : ''));

  async function submit(): Promise<void> {
    setFeedback(null);

    let parsedYear: number | null = null;
    if (includeBirthYear && birthYear.trim().length > 0) {
      const n = Number(birthYear.trim());
      if (!Number.isInteger(n) || n < 1900 || n > CURRENT_YEAR) {
        setFeedback('invalidYear');
        return;
      }
      parsedYear = n;
    }

    setBusy(true);
    // `full_name` is a separate column (the original one, predating this first/last split) that
    // every roster screen outside this user's own Impostazioni still reads — the Manager's "Persone"
    // list, the Admin's manager list, `PresenceList`, pending requests. Without also writing it here,
    // those kept showing the old name forever even though "Profilo aggiornato" said otherwise.
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ') || null;
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: trimmedFirst || null,
        last_name: trimmedLast || null,
        full_name: fullName,
        ...(includeBirthYear ? { birth_year: parsedYear } : {}),
      })
      .eq('id', userId);
    setBusy(false);
    if (error) {
      setFeedback('error');
      return;
    }
    setFeedback('success');
    void auth.refreshProfile();
  }

  const input = settingsInputStyle(theme);

  return (
    <SettingsGroup title={t('profile.title')}>
      <SettingsBlock>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText variant="caption" style={{ fontWeight: '700' }}>
              {t('profile.firstName')}
            </AppText>
            <TextInput
              value={firstName}
              onChangeText={(v) => {
                setFirstName(v);
                setFeedback(null);
              }}
              placeholder={t('profile.firstName')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('profile.firstName')}
              autoComplete="off"
              textContentType="givenName"
              style={input}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText variant="caption" style={{ fontWeight: '700' }}>
              {t('profile.lastName')}
            </AppText>
            <TextInput
              value={lastName}
              onChangeText={(v) => {
                setLastName(v);
                setFeedback(null);
              }}
              placeholder={t('profile.lastName')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('profile.lastName')}
              autoComplete="off"
              textContentType="familyName"
              style={input}
            />
          </View>
        </View>

        {includeBirthYear ? (
          <View style={{ gap: 6 }}>
            <AppText variant="caption" style={{ fontWeight: '700' }}>
              {t('profile.birthYear')}
            </AppText>
            <TextInput
              value={birthYear}
              onChangeText={(v) => {
                setBirthYear(v.replace(/[^0-9]/g, ''));
                setFeedback(null);
              }}
              placeholder="1990"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('profile.birthYear')}
              keyboardType="number-pad"
              maxLength={4}
              style={settingsInputStyle(theme, feedback === 'invalidYear')}
            />
          </View>
        ) : null}

        {feedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={feedback === 'success' ? theme.text : theme.danger} style={{ fontWeight: '600', fontSize: 13 }}>
              {t(feedback === 'success' ? 'profile.success' : feedback === 'invalidYear' ? 'profile.birthYear.invalid' : 'profile.error')}
            </AppText>
          </View>
        ) : null}

        <Button label={t('profile.save')} onPress={() => void submit()} disabled={busy || !changed} />
      </SettingsBlock>
    </SettingsGroup>
  );
}

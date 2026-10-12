import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card, SectionTitle } from './Card';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Self-editable "Nome/Cognome" for every role's Impostazioni, plus "Anno di nascita" for Coach and
 * Client only (not the Manager — per the request, the gym's owner account doesn't need it). Writes
 * directly to `profiles` (see `supabase/migrations/20260930010000_profile_details.sql`): the
 * column-level grant there only allows a signed-in user to touch their own first_name/last_name/
 * birth_year, never role/site_id/status.
 */
export function ProfileSection({ includeBirthYear = false }: { includeBirthYear?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();

  const initialFirst = auth.status === 'active' ? (auth.profile.firstName ?? '') : '';
  const initialLast = auth.status === 'active' ? (auth.profile.lastName ?? '') : '';
  const initialBirthYear = auth.status === 'active' && auth.profile.birthYear ? String(auth.profile.birthYear) : '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | 'invalidYear' | null>(null);

  if (auth.status !== 'active') return null;

  async function submit(): Promise<void> {
    if (auth.status !== 'active') return;
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
      .eq('id', auth.session.user.id);
    setBusy(false);
    if (error) {
      setFeedback('error');
      return;
    }
    setFeedback('success');
    void auth.refreshProfile();
  }

  const inputStyle = {
    minHeight: MIN_TAP + 4,
    borderWidth: 1.5,
    borderColor: feedback === 'invalidYear' ? theme.danger : theme.border,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    color: theme.text,
    backgroundColor: theme.background,
    fontFamily: fontFamily.body,
    fontSize: 16,
  } as const;

  return (
    <Card>
      <SectionTitle>{t('profile.title')}</SectionTitle>

      <AppText variant="caption" style={{ fontWeight: '600' }}>
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
        style={inputStyle}
      />

      <AppText variant="caption" style={{ fontWeight: '600' }}>
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
        style={inputStyle}
      />

      {includeBirthYear ? (
        <>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
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
            style={inputStyle}
          />
        </>
      ) : null}

      {feedback ? (
        <View accessibilityLiveRegion="polite">
          <AppText color={feedback === 'success' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
            {t(feedback === 'success' ? 'profile.success' : feedback === 'invalidYear' ? 'profile.birthYear.invalid' : 'profile.error')}
          </AppText>
        </View>
      ) : null}

      <Button label={t('profile.save')} variant="secondary" onPress={() => void submit()} disabled={busy} />
    </Card>
  );
}

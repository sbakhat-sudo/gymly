import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { PlusIcon } from '@/components/icons';
import { getOwnerChainName } from '@/features/owner/owner-api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatBirthInput, parseBirthDate } from '@/lib/domain/birth-date';
import { isPlausibleName } from '@/lib/domain/input-checks';
import { useI18n } from '@/lib/i18n';
import { uploadAvatar } from '@/lib/supabase/avatar';
import { supabase } from '@/lib/supabase/client';
import { getSiteName } from '@/lib/supabase/site-name';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

const MIN_PASSWORD = 8;
const BASE_STEPS = 6;

/**
 * The mandatory first-login profile, for staff accounts only (Owner, Manager, Coach — never Admin,
 * never the phone-app Client): shown once, the first time someone enters after being approved (or, for
 * a Manager an Owner created by hand, after their first sign-in). It can't be dismissed — everything
 * in it is required — but "Esci" is always there so nobody is ever stuck behind it. Completing it sets
 * `profiles.profile_completed_at` (via `complete_my_profile()`), which is what stops it from ever
 * showing again.
 */
export function CompleteProfileGate() {
  const auth = useAuth();
  const profile = auth.status === 'active' || auth.status === 'owner' ? auth.profile : null;
  const needsProfile = profile !== null && (profile.role === 'owner' || profile.role === 'manager' || profile.role === 'coach') && profile.profileCompletedAt === null;
  // Staff only ever use the web app (the phone shows them a "use the web version" screen instead).
  return needsProfile && Platform.OS === 'web' ? <CompleteProfileModal /> : null;
}

/** A labelled form row. Defined at module level on purpose: declared inside the modal it would be a new
 * component on every keystroke, remounting its input and dropping focus after each letter. */
function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontWeight: '700', fontSize: 13 }}>{label}</AppText>
      {children}
      {error ? (
        <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600' }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function CompleteProfileModal() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const profile = auth.status === 'active' || auth.status === 'owner' ? auth.profile : null;
  const userId = auth.status === 'active' || auth.status === 'owner' ? auth.session.user.id : null;
  const email = auth.status === 'active' || auth.status === 'owner' ? (auth.session.user.email ?? '') : '';

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [birth, setBirth] = useState('');
  const [address, setAddress] = useState(profile?.homeAddress ?? '');
  const [gymEdit, setGymEdit] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // True once the new password has really been saved (so a retry after a later failure doesn't redo it), and
  // when Supabase says the typed one is the same as the current (temporary) one.
  const [passwordSet, setPasswordSet] = useState(false);
  const [samePassword, setSamePassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const isOwner = profile?.role === 'owner';
  const siteId = profile && !isOwner && 'siteId' in profile ? profile.siteId : null;
  const chainName = useAsync(() => getOwnerChainName(), [], isOwner);
  const fixedGym = useAsync(() => (siteId ? getSiteName(siteId) : Promise.resolve(null)), [siteId], siteId !== null);
  // Until the Owner has typed the real name, the business carries a placeholder (their own name) — don't
  // offer that back as if it were the answer.
  const placeholderName = chainName.data === (profile?.fullName ?? null);
  const gymName = gymEdit ?? (chainName.data && !placeholderName ? chainName.data : '');
  const gymOk = gymName.trim().length >= 2;
  const totalSteps = BASE_STEPS + (isOwner ? 1 : 0);

  const hasPhoto = Boolean(profile?.avatarUrl);
  const firstOk = isPlausibleName(firstName);
  const lastOk = isPlausibleName(lastName);
  const birthIso = parseBirthDate(birth);
  const addressOk = address.trim().length >= 5;
  const passwordOk = password.length >= MIN_PASSWORD;
  const passwordsMatch = password === password2;
  const done = [hasPhoto, firstOk, lastOk, birthIso !== null, addressOk, passwordOk && passwordsMatch && password2.length > 0, ...(isOwner ? [gymOk] : [])].filter(Boolean).length;
  const allOk = done === totalSteps;

  async function pickPhoto(): Promise<void> {
    if (!userId) return;
    setPhotoError(false);
    // The browser's own file picker needs no OS-level permission (and asking only produced a false
    // "denied" on web), so only native asks — same as the photo button in Impostazioni.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError(true);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      await uploadAvatar(userId, result.assets[0].uri);
      await auth.refreshProfile();
    } catch {
      setPhotoError(true);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submit(): Promise<void> {
    setSubmitted(true);
    setSaveError(false);
    setSamePassword(false);
    if (!allOk || birthIso === null || busy) return;

    setBusy(true);
    try {
      if (!passwordSet) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) {
          // Supabase refuses a password equal to the current one — i.e. the temporary password the Manager/Owner
          // handed out. Choosing a different one is the whole point, so this stops here instead of passing.
          if (passwordError.message.toLowerCase().includes('different from the old password')) {
            setSamePassword(true);
            return;
          }
          throw passwordError;
        }
        setPasswordSet(true);
      }

      const { error } = await supabase.rpc('complete_my_profile', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_birth_date: birthIso,
        p_home_address: address,
        p_gym_name: isOwner ? gymName : null,
      });
      if (error) throw error;
      // The popup disappears by itself: the refreshed profile now carries `profileCompletedAt`.
      await auth.refreshProfile();
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    minHeight: MIN_TAP + 4,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontSize: 15,
  } as const;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,20,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: '96%', borderRadius: radius.sheet, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Pressable
                onPress={() => void pickPhoto()}
                disabled={uploadingPhoto}
                accessibilityRole="button"
                accessibilityLabel={t(hasPhoto ? 'profileSetup.photo.change' : 'profileSetup.photo.add')}
                style={{ width: 104, height: 104 }}>
                <Avatar uri={profile?.avatarUrl} name={profile?.fullName ?? null} size={104} />
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.primary,
                    borderWidth: 3,
                    borderColor: theme.background,
                  }}>
                  {uploadingPhoto ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <PlusIcon color={theme.onPrimary} size={16} strokeWidth={2.6} />}
                </View>
              </Pressable>
              <AppText variant="caption" muted style={{ fontWeight: '600' }}>
                {t('profileSetup.photo')}
              </AppText>
              {photoError ? (
                <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600' }}>
                  {t('profileSetup.photo.error')}
                </AppText>
              ) : submitted && !hasPhoto ? (
                <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600' }}>
                  {t('profileSetup.photo.missing')}
                </AppText>
              ) : null}
            </View>

            <View style={{ gap: 6, alignItems: 'center' }}>
              <AppText accessibilityRole="header" style={{ fontFamily: fontFamily.displaySemi, fontSize: 24, lineHeight: 29, letterSpacing: 24 * -0.04, textAlign: 'center' }}>
                {t('profileSetup.title')}
              </AppText>
              <AppText muted style={{ textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                {t('profileSetup.subtitle')}
              </AppText>
            </View>

            {/* Progress as a bar AND words, never colour alone. */}
            <View style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: totalSteps, now: done }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${(done / totalSteps) * 100}%`, borderRadius: 3, backgroundColor: theme.primary }} />
              </View>
              <AppText variant="caption" muted>
                {t('profileSetup.progress', { n: done, total: totalSteps })} · {t('profileSetup.required')}
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label={t('profileSetup.firstName')} error={submitted && !firstOk ? t(firstName.trim() ? 'profileSetup.name.invalid' : 'profileSetup.field.required') : null}>
                  <TextInput value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" accessibilityLabel={t('profileSetup.firstName')} maxLength={80} style={inputStyle} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('profileSetup.lastName')} error={submitted && !lastOk ? t(lastName.trim() ? 'profileSetup.name.invalid' : 'profileSetup.field.required') : null}>
                  <TextInput value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" accessibilityLabel={t('profileSetup.lastName')} maxLength={80} style={inputStyle} />
                </Field>
              </View>
            </View>

            <Field label={t('profileSetup.email')}>
              {/* The address they sign in with — already verified, so it is shown, not asked again. */}
              <TextInput value={email} editable={false} accessibilityLabel={t('profileSetup.email')} style={[inputStyle, { backgroundColor: theme.surfaceAlt, color: theme.textMuted }]} />
              <AppText variant="caption" muted>
                {t('profileSetup.email.hint')}
              </AppText>
            </Field>

            {isOwner ? (
              <Field label={t('profileSetup.gymName')} error={submitted && !gymOk ? t('profileSetup.field.required') : null}>
                <TextInput
                  value={gymName}
                  onChangeText={setGymEdit}
                  placeholder={t('profileSetup.gymName.placeholder')}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t('profileSetup.gymName')}
                  maxLength={120}
                  style={inputStyle}
                />
                <AppText variant="caption" muted>
                  {t('profileSetup.gymName.hint')}
                </AppText>
              </Field>
            ) : fixedGym.data ? (
              <Field label={t('profileSetup.gym')}>
                {/* Set by the Owner and the same for everyone under them — shown, never asked. */}
                <TextInput value={fixedGym.data} editable={false} accessibilityLabel={t('profileSetup.gym')} style={[inputStyle, { backgroundColor: theme.surfaceAlt, color: theme.textMuted }]} />
                <AppText variant="caption" muted>
                  {t('profileSetup.gym.hint')}
                </AppText>
              </Field>
            ) : null}

            <Field label={t('profileSetup.birthDate')} error={submitted && birthIso === null ? t('profileSetup.birthDate.invalid') : null}>
              <TextInput
                value={birth}
                onChangeText={(v) => setBirth(formatBirthInput(v))}
                placeholder={t('profileSetup.birthDate.placeholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={10}
                autoComplete="birthdate-full"
                accessibilityLabel={t('profileSetup.birthDate')}
                style={inputStyle}
              />
            </Field>

            <Field label={t('profileSetup.address')} error={submitted && !addressOk ? t('profileSetup.address.short') : null}>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder={t('profileSetup.address.placeholder')}
                placeholderTextColor={theme.textMuted}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                accessibilityLabel={t('profileSetup.address')}
                maxLength={200}
                style={inputStyle}
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label={t('profileSetup.password')} error={samePassword ? t('profileSetup.password.sameAsOld') : submitted && !passwordOk ? t('profileSetup.password.short') : null}>
                  <TextInput
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setSamePassword(false);
                    }}
                    editable={!passwordSet}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel={t('profileSetup.password')}
                    style={inputStyle}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('profileSetup.passwordConfirm')} error={submitted && passwordOk && (!passwordsMatch || password2.length === 0) ? t('profileSetup.password.mismatch') : null}>
                  <TextInput
                    value={password2}
                    onChangeText={setPassword2}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel={t('profileSetup.passwordConfirm')}
                    onSubmitEditing={() => void submit()}
                    style={inputStyle}
                  />
                </Field>
              </View>
            </View>

            {saveError ? <Banner title={t('profileSetup.error')} /> : null}

            <Button label={busy ? t('profileSetup.saving') : t('profileSetup.submit')} onPress={() => void submit()} disabled={busy || uploadingPhoto} />

            <Pressable onPress={() => void auth.signOut()} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: spacing.md }}>
              <AppText muted style={{ fontWeight: '600', fontSize: 13 }}>
                {t('account.signOut')}
              </AppText>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

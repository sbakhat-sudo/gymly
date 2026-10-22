import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { uploadAvatar } from '@/lib/supabase/avatar';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card, SectionTitle } from './Card';

/**
 * Account block shared by every role's Impostazioni screen: email (read-only), change password,
 * sign out. The Client's Settings screen already has its own language card (kept there, since it
 * sits among other member-only preferences); Manager/Coach add their own alongside this one.
 */
export function AccountSection() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  // Manager/Coach/Admin already have a sign-out entry in the sidebar nav (PillTabBar.tsx) once the
  // window is wide enough to show it — repeating the button here just duplicated it on screen.
  const isSidebar = useSidebarMode();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | 'tooShort' | 'sameAsOld' | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<'permission' | 'permissionBlocked' | 'error' | null>(null);

  const email = auth.status !== 'loading' && auth.status !== 'signedOut' ? auth.session.user.email : undefined;
  const userId = auth.status !== 'loading' && auth.status !== 'signedOut' ? auth.session.user.id : null;
  const profile = auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? auth.profile : null;
  // Lazy initial state (not an effect): this component mounts once per Impostazioni visit, by which
  // point `profile` is already resolved — no need to sync it on every re-render.
  const [name, setName] = useState(() => profile?.fullName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<'success' | 'error' | null>(null);

  async function saveName(): Promise<void> {
    if (!userId) return;
    setSavingName(true);
    setNameFeedback(null);
    // `full_name` is self-updatable by any authenticated role (grant update (full_name) ... to
    // authenticated, RLS row check id = auth.uid()) — already in place since the very first
    // migration, no new backend needed for this.
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() || null }).eq('id', userId);
    setSavingName(false);
    if (error) {
      setNameFeedback('error');
      return;
    }
    await auth.refreshProfile();
    setNameFeedback('success');
  }

  async function changePhoto(): Promise<void> {
    if (!userId) return;
    setPhotoNotice(null);
    // `requestMediaLibraryPermissionsAsync` "does nothing on web" (Expo's own docs) — the browser's
    // file picker needs no OS-level grant, so asking there only produced a false "permission denied"
    // on every role's web-only Impostazioni screen (Manager/Coach/Admin).
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoNotice(permission.canAskAgain ? 'permission' : 'permissionBlocked');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    setPhotoNotice(null);
    try {
      await uploadAvatar(userId, result.assets[0].uri);
      await auth.refreshProfile();
    } catch {
      setPhotoNotice('error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function updatePassword(): Promise<void> {
    if (password.trim().length < 6) {
      setFeedback('tooShort');
      return;
    }
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.auth.updateUser({ password: password.trim() });
    setBusy(false);
    if (error) {
      // Supabase's own wording for this one case: "New password should be different from the old
      // password" — duck-typed substring match, same pattern ManagerSignupScreen uses for "already
      // registered" (PostgrestError-style errors don't reliably satisfy `instanceof Error`).
      setFeedback(error.message.toLowerCase().includes('different from the old password') ? 'sameAsOld' : 'error');
      return;
    }
    setPassword('');
    setFeedback('success');
  }

  return (
    <>
      <Card>
        <SectionTitle>{t('account.title')}</SectionTitle>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar uri={profile?.avatarUrl} name={profile?.fullName ?? null} size={64} />
          <View style={{ gap: 6, flex: 1 }}>
            <Button label={t('account.photo.change')} variant="secondary" onPress={() => void changePhoto()} disabled={uploadingPhoto} />
            {uploadingPhoto ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <AppText variant="caption" muted>
                  {t('account.photo.uploading')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        {photoNotice ? (
          <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
            <AppText color={theme.danger} style={{ fontWeight: '600' }}>
              {t(
                photoNotice === 'permission'
                  ? 'account.photo.permission'
                  : photoNotice === 'permissionBlocked'
                    ? 'account.photo.permissionBlocked'
                    : 'account.photo.error'
              )}
            </AppText>
            {photoNotice === 'permissionBlocked' ? (
              <Button label={t('account.photo.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
            ) : null}
          </View>
        ) : null}

        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('account.name.title')}
        </AppText>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameFeedback(null);
          }}
          placeholder={t('account.name.placeholder')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('account.name.title')}
          returnKeyType="done"
          onSubmitEditing={() => void saveName()}
          style={{
            minHeight: MIN_TAP + 4,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderRadius: 16,
            paddingHorizontal: spacing.lg,
            color: theme.text,
            backgroundColor: theme.background,
            fontFamily: fontFamily.body,
            fontSize: 16,
          }}
        />
        {nameFeedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={nameFeedback === 'success' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(nameFeedback === 'success' ? 'account.name.success' : 'account.name.error')}
            </AppText>
          </View>
        ) : null}
        <Button label={t('account.name.save')} variant="secondary" onPress={() => void saveName()} disabled={savingName || name.trim() === (profile?.fullName ?? '')} />

        {email ? <AppText muted>{email}</AppText> : null}

        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('account.password.title')}
        </AppText>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setFeedback(null);
          }}
          placeholder={t('account.password.new')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('account.password.new')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          returnKeyType="done"
          onSubmitEditing={() => void updatePassword()}
          style={{
            minHeight: MIN_TAP + 4,
            borderWidth: 1.5,
            borderColor: feedback === 'error' || feedback === 'tooShort' || feedback === 'sameAsOld' ? theme.danger : theme.border,
            borderRadius: 16,
            paddingHorizontal: spacing.lg,
            color: theme.text,
            backgroundColor: theme.background,
            fontFamily: fontFamily.body,
            fontSize: 16,
          }}
        />
        {feedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={feedback === 'success' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(
                feedback === 'success'
                  ? 'account.password.success'
                  : feedback === 'tooShort'
                    ? 'account.password.tooShort'
                    : feedback === 'sameAsOld'
                      ? 'account.password.sameAsOld'
                      : 'account.password.error'
              )}
            </AppText>
          </View>
        ) : null}
        <Button
          label={t('account.password.button')}
          variant="secondary"
          onPress={() => void updatePassword()}
          disabled={busy || password.trim().length === 0}
        />

        {isSidebar ? null : <Button label={t('account.signOut')} variant="dangerSoft" onPress={() => void auth.signOut()} style={{ marginTop: spacing.sm }} />}
      </Card>
    </>
  );
}

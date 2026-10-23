import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { AppText } from './AppText';
import { Button } from './Button';
import { LogOutIcon } from './icons';
import { SettingsBlock, SettingsGroup, SettingsRow, settingsInputStyle } from './settings/SettingsKit';

/**
 * The "Sicurezza" and "Account" groups shared by every role's Impostazioni: change password, and sign out.
 * (The photo, name and email moved out: the photo lives on the profile card at the top — `ProfileHero` —
 * and the name in `ProfileSection`, so nothing is asked twice.)
 */
export function AccountSection() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  // Manager/Coach/Admin/Owner already have a sign-out entry in the sidebar nav (PillTabBar.tsx) once the
  // window is wide enough to show it — repeating it here just duplicated it on screen.
  const isSidebar = useSidebarMode();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | 'tooShort' | 'sameAsOld' | null>(null);

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

  const invalid = feedback === 'error' || feedback === 'tooShort' || feedback === 'sameAsOld';

  return (
    <>
      <SettingsGroup title={t('settings.security')}>
        <SettingsBlock>
          <AppText variant="caption" style={{ fontWeight: '700' }}>
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
            style={settingsInputStyle(theme, invalid)}
          />
          {feedback ? (
            <View accessibilityLiveRegion="polite">
              <AppText color={feedback === 'success' ? theme.text : theme.danger} style={{ fontWeight: '600', fontSize: 13 }}>
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
          <Button label={t('account.password.button')} variant="secondary" onPress={() => void updatePassword()} disabled={busy || password.trim().length === 0} />
        </SettingsBlock>
      </SettingsGroup>

      {isSidebar ? null : (
        <SettingsGroup title={t('account.title')}>
          <SettingsRow icon={LogOutIcon} label={t('account.signOut')} destructive onPress={() => void auth.signOut()} />
        </SettingsGroup>
      )}
    </>
  );
}

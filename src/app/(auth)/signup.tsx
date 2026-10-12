import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ChevronLeftIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth/auth-context';
import { ManagerSignupScreen } from '@/features/auth/ManagerSignupScreen';
import type { ManagerPlan } from '@/features/auth/ManagerPlanCards';
import { RoleAndSiteFields, submitRoleAndSite, useRoleAndSiteFields, type Role } from '@/features/auth/RoleAndSiteForm';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';

/** Coach never picks a role from a list, it reaches this screen through its own QR code/link,
 * which carries it as `?role=coach`. Manager has an entirely separate screen (a plan choice
 * first, then an Admin approval wait) — see ManagerSignupScreen.
 *
 * Client is phone-only (Expo Go) — there is no "Cliente" option on web at all, self-serve or
 * not: a Manager's own gym is the only thing a stranger can sign up for from a browser, so a bare
 * web visit to this screen goes straight to ManagerSignupScreen instead of offering a role choice. */
function planFromParam(plan: string | string[] | undefined): ManagerPlan | undefined {
  const v = Array.isArray(plan) ? plan[0] : plan;
  return v === 'trial' || v === 'pro' || v === 'business' ? v : undefined;
}

export default function SignupScreen() {
  const { role, plan } = useLocalSearchParams<{ role?: string; plan?: string }>();
  const isNative = Platform.OS !== 'web';
  const initialPlan = planFromParam(plan);

  // Manager only signs up from a browser (same reasoning as the comment above for a bare native
  // visit): on native, role=manager (even via a deep link) falls through to the Client form below
  // instead, exactly like no role param was given at all.
  if (role === 'manager' && !isNative) return <ManagerSignupScreen initialPlan={initialPlan} />;
  if (role === 'coach') return <ClientOrCoachSignupScreen initialRole="coach" />;
  if (!isNative) return <ManagerSignupScreen initialPlan={initialPlan} />;

  return <ClientOrCoachSignupScreen initialRole="client" />;
}

function ClientOrCoachSignupScreen({ initialRole }: { initialRole: Role }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const fields = useRoleAndSiteFields(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function submit(): Promise<void> {
    if (!fields.isValid) {
      setError(t('auth.signup.error.missingSite'));
      return;
    }
    if (password.trim().length < 6) {
      setError(t('auth.signup.error.weakPassword'));
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password: password.trim() });
    if (err) {
      setBusy(false);
      setError(err.message.toLowerCase().includes('already registered') ? t('auth.signup.error.emailTaken') : t('auth.signup.error'));
      return;
    }
    if (!data.user) {
      setBusy(false);
      setError(t('auth.signup.error'));
      return;
    }
    if (data.session) {
      // A session exists right away (no email confirmation required): attach the role/gym now,
      // so the member never sees a separate "finish your profile" step.
      const roleErr = await submitRoleAndSite(fields.values());
      setBusy(false);
      if (roleErr) {
        setError(roleErr);
        return;
      }
      await auth.refreshProfile();
      router.replace('/');
      return;
    }
    // No session yet: email confirmation is required first. The role/gym choice is remembered
    // locally and replayed automatically once the member confirms and signs in.
    await storage.set('pendingRegistration', fields.values());
    setBusy(false);
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <Screen>
        <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
          <AppText variant="headline">{t('auth.pending.title')}</AppText>
          <AppText muted>{t('auth.pending.body')}</AppText>
          <Button label={t('auth.login.button')} onPress={() => router.replace('/(auth)/login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
            <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
          </Pressable>
        ) : null}

        <AppText variant="display" style={{ fontSize: 40 }}>
          {t('auth.signup.title')}
        </AppText>

        <RoleAndSiteFields fields={fields} />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('auth.signup.email')}
          </AppText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.signup.email')}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t('auth.signup.email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
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
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('auth.signup.password')}
          </AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.signup.password')}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t('auth.signup.password')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            style={{
              minHeight: MIN_TAP + 4,
              borderWidth: 1.5,
              borderColor: error ? theme.danger : theme.border,
              borderRadius: 16,
              paddingHorizontal: spacing.lg,
              color: theme.text,
              backgroundColor: theme.background,
              fontFamily: fontFamily.body,
              fontSize: 16,
            }}
          />
        </View>

        {error ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={theme.danger} style={{ fontWeight: '600' }}>
              {error}
            </AppText>
          </View>
        ) : null}

        <Button
          label={t('auth.signup.button')}
          onPress={() => void submit()}
          disabled={busy || email.trim().length === 0 || password.length === 0}
        />

        <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md }}>
          <AppText muted>{t('auth.signup.haveAccount')}</AppText>
          <AppText color={theme.primary} style={{ fontWeight: '700' }} onPress={() => router.push('/(auth)/login')}>
            {t('auth.signup.loginLink')}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

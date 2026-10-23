import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckIcon, ChevronLeftIcon } from '@/components/icons';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { isPlausibleName, isPlausiblePhone } from '@/lib/domain/input-checks';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { ManagerBadge, PlanCard, PLAN_NAME_KEY, PLAN_ORDER, type ManagerPlan } from './ManagerPlanCards';

/**
 * The Owner's ("Titolare") own signup flow — a direct clone of `ManagerSignupScreen.tsx`'s
 * mechanism (plan picker first, account details, Admin approval wait, then create their own
 * business), since Manager no longer self-registers at all (product decision): a Manager account is
 * only ever created by an Owner, via `owner_create_manager_record()` (already built, already active
 * immediately, no approval queue). This screen is the Owner's equivalent of that old entry point.
 *
 * `initialPlan` lets a plan already chosen elsewhere (the pricing section on Welcome) skip the
 * picker entirely — picking it there already satisfies "a plan before anything else".
 */
export function OwnerSignupScreen({ initialPlan }: { initialPlan?: ManagerPlan } = {}) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const [plan, setPlan] = useState<ManagerPlan | null>(initialPlan ?? null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function submit(): Promise<void> {
    if (!plan) return;
    if (fullName.trim() && !isPlausibleName(fullName)) {
      setError(t('auth.signup.error.invalidName'));
      return;
    }
    if (phone.trim() && !isPlausiblePhone(phone)) {
      setError(t('auth.signup.error.invalidPhone'));
      return;
    }
    if (password.trim().length < 6) {
      setError(t('auth.signup.error.weakPassword'));
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError(t('auth.signup.error.passwordMismatch'));
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
      const { error: rpcError } = await supabase.rpc('request_owner_signup', { p_plan: plan, p_full_name: fullName.trim() || null, p_phone: phone.trim() || null });
      setBusy(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      await auth.refreshProfile();
      return;
    }
    // No session yet: email confirmation required first. Replayed once a session is available —
    // see complete-profile.tsx.
    await storage.set('pendingOwnerPlan', { plan, fullName: fullName.trim(), phone: phone.trim() });
    setBusy(false);
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <Screen>
        <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
          <AppText variant="headline">{t('auth.pending.confirmEmail.title')}</AppText>
          <AppText muted>{t('auth.pending.confirmEmail.body')}</AppText>
          <Button label={t('auth.login.button')} onPress={() => router.replace('/(auth)/login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={{
            flexDirection: 'row',
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: 6,
            minHeight: MIN_TAP,
            paddingHorizontal: spacing.md,
            borderRadius: MIN_TAP / 2,
            backgroundColor: theme.surfaceAlt,
            borderWidth: 1.5,
            borderColor: theme.border,
          }}>
          <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
          <AppText style={{ fontWeight: '700', fontSize: 15 }}>{t('common.back')}</AppText>
        </Pressable>

        <AppText variant="display" style={{ fontSize: 40 }}>
          {t('ownerSignup.title')}
        </AppText>

        {plan ? (
          <FadeSlideIn>
            <Pressable
              onPress={() => setPlan(null)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: theme.glass,
                borderWidth: 1,
                borderColor: theme.glassBorder,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CheckIcon color={theme.primary} size={16} />
                <AppText style={{ fontWeight: '700' }}>{t('ownerSignup.planChosen', { plan: t(PLAN_NAME_KEY[plan]) })}</AppText>
              </View>
              <AppText style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>{t('ownerSignup.changePlan')}</AppText>
            </Pressable>
          </FadeSlideIn>
        ) : null}

        {plan ? (
          <FadeSlideIn delay={80}>
            <View style={{ gap: spacing.lg }}>
              <Field label={t('auth.signup.fullName')} value={fullName} onChangeText={setFullName} accessibilityLabel={t('auth.signup.fullName')} />
              <Field
                label={t('auth.signup.email')}
                value={email}
                onChangeText={setEmail}
                accessibilityLabel={t('auth.signup.email')}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <Field
                label={t('auth.signup.phone')}
                value={phone}
                onChangeText={setPhone}
                accessibilityLabel={t('auth.signup.phone')}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
              <Field
                label={t('auth.signup.password')}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel={t('auth.signup.password')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                danger={error !== null}
              />
              <Field
                label={t('auth.signup.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                accessibilityLabel={t('auth.signup.confirmPassword')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                danger={error !== null}
              />

              {error ? (
                <View accessibilityLiveRegion="polite">
                  <AppText color={theme.danger} style={{ fontWeight: '600' }}>
                    {error}
                  </AppText>
                </View>
              ) : null}

              <Button label={t('ownerSignup.submit')} onPress={() => void submit()} disabled={busy || email.trim().length === 0 || password.length === 0} />

              <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md }}>
                <AppText muted>{t('auth.signup.haveAccount')}</AppText>
                <AppText color={theme.primary} style={{ fontWeight: '700' }} onPress={() => router.push('/(auth)/login')}>
                  {t('auth.signup.loginLink')}
                </AppText>
              </View>
            </View>
          </FadeSlideIn>
        ) : null}
      </View>

      <PlanPickerModal visible={plan === null} onPick={setPlan} />
    </Screen>
  );
}

function Field({
  label,
  danger,
  ...inputProps
}: {
  label: string;
  danger?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  accessibilityLabel: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoComplete?: 'email' | 'name' | 'new-password' | 'tel';
  textContentType?: 'emailAddress' | 'name' | 'newPassword' | 'telephoneNumber';
  returnKeyType?: 'done';
  onSubmitEditing?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <TextInput
        {...inputProps}
        placeholder={label}
        placeholderTextColor={theme.textMuted}
        style={{
          minHeight: MIN_TAP + 4,
          borderWidth: 1.5,
          borderColor: danger ? theme.danger : theme.border,
          borderRadius: 16,
          paddingHorizontal: spacing.lg,
          color: theme.text,
          backgroundColor: theme.background,
          fontFamily: fontFamily.body,
          fontSize: 16,
        }}
      />
    </View>
  );
}

/** Mandatory first step: no backdrop dismiss, no skip — an Owner account doesn't exist until one is picked. */
function PlanPickerModal({ visible, onPick }: { visible: boolean; onPick: (plan: ManagerPlan) => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const [selected, setSelected] = useState<ManagerPlan | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<ManagerPlan | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelected(null);
      setHoveredPlan(null);
    }
  }

  function pick(plan: ManagerPlan): void {
    if (selected) return;
    setSelected(plan);
    setTimeout(() => onPick(plan), reduceMotion ? 0 : 360);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: spacing.xxl, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={{
              flexDirection: 'row',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 6,
              minHeight: MIN_TAP,
              paddingHorizontal: spacing.md,
              borderRadius: MIN_TAP / 2,
              backgroundColor: theme.surfaceAlt,
              borderWidth: 1.5,
              borderColor: theme.border,
            }}>
            <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            <AppText style={{ fontWeight: '700', fontSize: 15 }}>{t('common.back')}</AppText>
          </Pressable>

          <View style={{ gap: 10 }}>
            <ManagerBadge activePlan={selected ?? hoveredPlan} label="ownerSignup.badge" />
            <AppText variant="display" style={{ fontSize: 30 }}>
              {t('ownerSignup.plan.title')}
            </AppText>
            <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
              {t('ownerSignup.plan.subtitle')}
            </AppText>
          </View>

          <View style={{ gap: spacing.md }}>
            {PLAN_ORDER.map((p, i) => (
              <FadeSlideIn key={p} delay={i * 90}>
                <PlanCard
                  plan={p}
                  selected={selected === p}
                  dimmed={selected !== null && selected !== p}
                  hovered={hoveredPlan === p}
                  onHoverIn={() => setHoveredPlan(p)}
                  onHoverOut={() => setHoveredPlan((h) => (h === p ? null : h))}
                  onPress={() => pick(p)}
                />
              </FadeSlideIn>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

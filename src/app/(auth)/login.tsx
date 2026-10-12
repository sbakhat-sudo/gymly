import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { decorativeA11yProps } from '@/lib/a11y';
import { useAppState } from '@/lib/app-state';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';

type Field = 'email' | 'password';

/**
 * Aurora "Accedi": Supabase email + password sign-in, restyled after the design (logo header,
 * big title, 56pt fields with a focus ring, bold pill CTA). Apple/Google are shown as in the design
 * but are not wired (no third-party SDKs): tapping them says so. "Continua senza account" opens the
 * member app as a guest.
 */
export default function LoginScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { setGuest } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [socialNote, setSocialNote] = useState(false);

  const ready = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit(): Promise<void> {
    if (!ready) return;
    setBusy(true);
    setError(false);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(true);
    // On success, the root AuthGate reacts to the new session automatically — no navigation needed here.
  }

  const inputStyle = (field: Field): TextStyle[] => [
    {
      height: 56,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: field === 'password' && error ? theme.danger : focused === field ? theme.primary : theme.border,
      backgroundColor: theme.surface,
      color: theme.text,
      paddingHorizontal: 18,
      fontFamily: fontFamily.bodyMedium,
      fontSize: 16,
    },
    focused === field && Platform.OS === 'web' ? ({ boxShadow: `0 0 0 4px ${theme.primary}33` } as TextStyle) : {},
  ];

  return (
    <Screen orb={{ color: theme.primary, top: 20, size: 440 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="image" accessibilityLabel="Gymly">
          <LogoMark size={34} bgColor={theme.background} />
          <Wordmark size={22} />
        </View>
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, backgroundColor: theme.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 22, paddingHorizontal: 6 }}>
        <View style={{ gap: spacing.sm, marginTop: 40 }}>
          <AppText variant="headline" accessibilityRole="header" style={{ fontSize: 34, lineHeight: 38, letterSpacing: 34 * -0.055 }}>
            {t('auth.login.title')}
          </AppText>
          <AppText muted style={{ fontSize: 15, lineHeight: 21 }}>
            {t('login.subtitle')}
          </AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText style={{ fontSize: 13, fontWeight: '600', paddingLeft: 4 }}>{t('auth.login.email')}</AppText>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(false);
            }}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder={t('login.email.placeholder')}
            placeholderTextColor={theme.faint}
            accessibilityLabel={t('auth.login.email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            maxFontSizeMultiplier={1.4}
            style={inputStyle('email')}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText style={{ fontSize: 13, fontWeight: '600', paddingLeft: 4 }}>{t('auth.login.password')}</AppText>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(false);
            }}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            placeholder={t('auth.login.password')}
            placeholderTextColor={theme.faint}
            accessibilityLabel={t('auth.login.password')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            maxFontSizeMultiplier={1.4}
            style={inputStyle('password')}
          />
          {error ? (
            <View accessibilityLiveRegion="polite">
              <AppText color={theme.danger} style={{ fontSize: 13, fontWeight: '600', paddingLeft: 4 }}>
                {t('auth.login.error')}
              </AppText>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => void submit()}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel={t('auth.login.button')}
          accessibilityState={{ disabled: !ready, busy }}
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.text,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: !ready ? 0.45 : pressed ? 0.85 : 1,
          })}>
          <AppText color={theme.background} style={{ fontWeight: '700' }}>
            {t('login.continue')}
          </AppText>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.background} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...decorativeA11yProps}>
            <Path d="M5 12h14M13 6l6 6-6 6" />
          </Svg>
        </Pressable>

        <View {...decorativeA11yProps} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          <AppText color={theme.faint} style={{ fontSize: 12 }}>
            {t('login.or')}
          </AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SocialButton label="Apple" onPress={() => setSocialNote(true)} icon={<AppleGlyph color={theme.text} />} />
          <SocialButton
            label="Google"
            onPress={() => setSocialNote(true)}
            icon={<AppText style={{ fontFamily: fontFamily.display, fontSize: 16, lineHeight: 20 }}>G</AppText>}
          />
        </View>
        {socialNote ? (
          <View accessibilityLiveRegion="polite">
            <AppText muted style={{ fontSize: 13, textAlign: 'center' }}>
              {t('login.social.unavailable')}
            </AppText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', alignItems: 'center' }}>
          <AppText muted style={{ fontSize: 14 }}>
            {t('auth.login.noAccount')}
          </AppText>
          <Pressable onPress={() => router.push('/(auth)/signup')} accessibilityRole="link" hitSlop={10} style={{ minHeight: MIN_TAP, justifyContent: 'center' }}>
            <AppText color={theme.primary} style={{ fontSize: 14, fontWeight: '700' }}>
              {t('auth.login.signupLink')}
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 10, marginTop: spacing.xl }}>
        <Pressable onPress={() => setGuest(true)} accessibilityRole="button" style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText style={{ fontSize: 15, fontWeight: '600' }}>{t('login.skip')}</AppText>
          <ChevronRightIcon color={theme.text} size={14} strokeWidth={2.4} />
        </Pressable>
        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 300 }}>
          {t('login.legal')}
        </AppText>
      </View>
    </Screen>
  );
}

function SocialButton({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}>
      <View {...decorativeA11yProps}>{icon}</View>
      <AppText style={{ fontSize: 15, fontWeight: '600' }}>{label}</AppText>
    </Pressable>
  );
}

function AppleGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={color} {...decorativeA11yProps}>
      <Path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </Svg>
  );
}

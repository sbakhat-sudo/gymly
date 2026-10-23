import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChevronLeftIcon, DumbbellIcon } from '@/components/icons';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import { createGym } from './manager-api';

/**
 * The first thing an Admin-approved Manager does: create their gym. A dedicated screen (not the
 * generic Coach/Client `RoleAndSiteForm`) so it can be designed specifically for this one-time,
 * important moment — a clean entrance animation and a single focused card, not a plain form.
 */
export function CreateGymScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [chainName, setChainName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (name.trim().length === 0) {
      setError(t('auth.signup.error.missingGymName'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createGym(name, address, chainName);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('createGym.error'));
    } finally {
      setBusy(false);
    }
  }

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
    <Screen>
      <View style={{ paddingTop: spacing.xxl * 1.5, gap: spacing.xl }}>
        {/* This screen is only reached with a real session already open (an Admin-approved Manager
            with no gym yet) — a plain back/navigate would just get bounced right back here by the
            root layout's guards, so the only real way out is to sign out, same pattern as
            complete-profile.tsx's own generic fallback branch. */}
        <Pressable
          onPress={onBack}
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

        <FadeSlideIn>
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${theme.primary}22`,
              }}>
              <DumbbellIcon color={theme.primary} size={30} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <AppText variant="display" style={{ fontSize: 28, textAlign: 'center' }}>
                {t('createGym.title')}
              </AppText>
              <AppText muted style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 }}>
                {t('createGym.subtitle')}
              </AppText>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={100}>
          <View
            style={{
              borderRadius: radius.card,
              padding: spacing.lg,
              gap: spacing.lg,
              backgroundColor: theme.glass,
              borderWidth: 1,
              borderColor: theme.glassBorder,
            }}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('auth.signup.gymName')}
              </AppText>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
                placeholder={t('auth.signup.gymName')}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t('auth.signup.gymName')}
                style={[inputStyle, error ? { borderColor: theme.danger } : null]}
              />
            </View>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('auth.signup.gymAddress')}
              </AppText>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder={t('auth.signup.gymAddress')}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t('auth.signup.gymAddress')}
                style={inputStyle}
              />
            </View>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('auth.signup.gymChainName')}
              </AppText>
              <TextInput
                value={chainName}
                onChangeText={setChainName}
                placeholder={t('auth.signup.gymChainName.placeholder')}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t('auth.signup.gymChainName')}
                style={inputStyle}
              />
              <AppText variant="caption" muted style={{ fontSize: 12, lineHeight: 17 }}>
                {t('auth.signup.gymChainName.help')}
              </AppText>
            </View>

            {error ? (
              <View accessibilityLiveRegion="polite">
                <AppText color={theme.danger} style={{ fontWeight: '600' }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <Button label={t('createGym.submit')} onPress={() => void submit()} disabled={busy} />
          </View>
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

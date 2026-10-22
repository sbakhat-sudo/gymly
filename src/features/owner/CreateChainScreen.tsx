import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DumbbellIcon } from '@/components/icons';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';

/**
 * The first thing an Admin-approved Owner does: name their business. Simpler than Manager's
 * `CreateGymScreen.tsx` on purpose — just the name, no address/timezone (the Owner's own HQ address
 * is set later, in Impostazioni → "Posizione sede"; a Manager-run site's own address is entered when
 * the Owner adds that Manager).
 */
export function CreateChainScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (name.trim().length === 0) {
      setError(t('createChain.error.missingName'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('create_owner_chain', { p_name: name.trim() });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
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
        <FadeSlideIn>
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: `${theme.primary}22` }}>
              <DumbbellIcon color={theme.primary} size={30} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <AppText variant="display" style={{ fontSize: 28, textAlign: 'center' }}>
                {t('createChain.title')}
              </AppText>
              <AppText muted style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 }}>
                {t('createChain.subtitle')}
              </AppText>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={100}>
          <View style={{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.lg, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('createChain.name')}
              </AppText>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
                placeholder={t('createChain.name')}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t('createChain.name')}
                style={[inputStyle, error ? { borderColor: theme.danger } : null]}
              />
            </View>

            {error ? (
              <View accessibilityLiveRegion="polite">
                <AppText color={theme.danger} style={{ fontWeight: '600' }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <Button label={t('createChain.submit')} onPress={() => void submit()} disabled={busy} />
          </View>
        </FadeSlideIn>
      </View>
    </Screen>
  );
}

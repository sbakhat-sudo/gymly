import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { getSettings, updateSettings, type PlatformSettings } from './admin-api';

/**
 * Only one setting is actually wired in: `default_capacity_reference` feeds every new gym's
 * starting capacity (`create_manager_site()`). No decorative toggles that don't do anything —
 * this project never fakes a control.
 */
export function AdminParametriScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const [loaded, setLoaded] = useState<PlatformSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'error' | 'invalid' | null>(null);

  useEffect(() => {
    let alive = true;
    getSettings().then(
      (s) => {
        if (!alive) return;
        setLoaded(s);
        setCapacity(String(s.defaultCapacityReference));
        setEmail(s.supportEmail ?? '');
      },
      () => alive && setLoadError(true)
    );
    return () => {
      alive = false;
    };
  }, []);

  async function save(): Promise<void> {
    const n = Number(capacity);
    if (!Number.isInteger(n) || n < 1) {
      setFeedback('invalid');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateSettings({ defaultCapacityReference: n, supportEmail: email.trim() || null });
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <BackButton href="/(admin)/impostazioni" />
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('admin.params.title')}
        </AppText>
      </View>

      {loadError ? <Banner title={t('admin.params.error')} /> : null}
      {loaded === null && !loadError ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}

      {loaded ? (
        <Card>
          <SectionTitle>{t('admin.params.capacity.title')}</SectionTitle>
          <AppText variant="caption" muted>
            {t('admin.params.capacity.help')}
          </AppText>
          <TextInput
            value={capacity}
            onChangeText={(v) => {
              setCapacity(v.replace(/[^0-9]/g, ''));
              setFeedback(null);
            }}
            keyboardType="number-pad"
            accessibilityLabel={t('admin.params.capacity.title')}
            style={{
              minHeight: MIN_TAP,
              borderWidth: 1.5,
              borderColor: feedback === 'invalid' ? theme.danger : theme.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              color: theme.text,
              fontSize: 15,
              fontVariant: ['tabular-nums'],
            }}
          />

          <SectionTitle>{t('admin.params.supportEmail.title')}</SectionTitle>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setFeedback(null);
            }}
            placeholder="supporto@gymly.app"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel={t('admin.params.supportEmail.title')}
            style={{
              minHeight: MIN_TAP,
              borderWidth: 1.5,
              borderColor: theme.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              color: theme.text,
              fontSize: 15,
            }}
          />

          {feedback ? (
            <View accessibilityLiveRegion="polite">
              <AppText color={feedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
                {t(feedback === 'saved' ? 'admin.params.saved' : feedback === 'invalid' ? 'admin.params.invalid' : 'admin.params.error')}
              </AppText>
            </View>
          ) : null}

          <Button label={t('admin.params.save')} onPress={() => void save()} disabled={saving} />
        </Card>
      ) : null}
    </Screen>
  );
}

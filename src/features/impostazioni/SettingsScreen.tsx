import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useAppState } from '@/lib/app-state';
import { ALERT_PRESETS, DEFAULT_ALERT_PRESET, presetOf, type AlertPreset, type AlertWindow } from '@/lib/domain/alerts';
import { useI18n, type Lang } from '@/lib/i18n';
import { requestAlertPermission } from '@/lib/notifications';
import { clearSessionCaches } from '@/lib/queries';
import { useApi, useClock, useDemoControls } from '@/lib/services-context';
import { useCurrentSite } from '@/lib/sites-context';
import { storage } from '@/lib/storage';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { Segmented } from '@/components/Segmented';

interface AlertPrefs {
  optIn: boolean;
  window: AlertWindow;
  /** The member has seen a band at least once (spec §7: only then may we offer notifications). */
  valueSeen: boolean;
}

export function SettingsScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
  const clock = useClock();
  const demo = useDemoControls();
  const { siteId, setSiteId, setLang, sessionCount, demoMode, setDemoMode, resetToInitial } = useAppState();
  const sites = useCurrentSite();

  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [alertNotice, setAlertNotice] = useState<'denied' | 'unsupported' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([storage.get('alertOptIn'), storage.get('alertWindow'), storage.get('valueSeen')]).then(([optIn, window, valueSeen]) => {
      if (alive) setPrefs({ optIn: optIn ?? false, window: window ?? ALERT_PRESETS[DEFAULT_ALERT_PRESET], valueSeen: valueSeen ?? false });
    });
    return () => {
      alive = false;
    };
  }, [deleted]);

  // Notification permission is requested ONLY from the 2nd session on, and only after a band has been seen.
  const canOfferAlerts = sessionCount >= 2 && prefs?.valueSeen === true;

  async function toggleAlerts(next: boolean): Promise<void> {
    if (!prefs) return;
    setAlertNotice(null);
    if (!next) {
      await storage.set('alertOptIn', false);
      setPrefs({ ...prefs, optIn: false });
      return;
    }
    const result = await requestAlertPermission();
    if (result !== 'granted') {
      setAlertNotice(result);
      return;
    }
    await storage.set('alertOptIn', true);
    await storage.set('alertWindow', prefs.window);
    setPrefs({ ...prefs, optIn: true });
  }

  async function chooseWindow(preset: AlertPreset): Promise<void> {
    if (!prefs) return;
    const window = ALERT_PRESETS[preset];
    await storage.set('alertWindow', window);
    setPrefs({ ...prefs, window });
  }

  async function deleteEverything(): Promise<void> {
    setConfirmingDelete(false);
    try {
      await api.requestDataDeletion();
    } catch {
      // Offline: the local wipe below still happens; the service-side erasure is retried by the real backend.
    }
    await storage.clearAll();
    clearSessionCaches();
    demo?.resetScenario();
    clock.setOffsetMs(0);
    resetToInitial();
    setPrefs(null);
    setAlertNotice(null);
    setDeleted(true);
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const showDemo = __DEV__ || demoMode;

  return (
    <Screen>
      <AppText variant="headline" accessibilityRole="header">
        {t('settings.title')}
      </AppText>

      {deleted ? <Banner message={t('settings.delete.done')} /> : null}

      <Card>
        <SectionTitle>{t('settings.gym')}</SectionTitle>
        {(sites.data ?? []).map((site) => {
          const selected = site.site_id === siteId;
          return (
            <Pressable
              key={site.site_id}
              onPress={() => {
                setSiteId(site.site_id);
                setDeleted(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${site.name}${selected ? `, ${t('settings.gym.selected')}` : ''}`}
              style={{
                minHeight: MIN_TAP + 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.surfaceAlt : 'transparent',
              }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>{site.name}</AppText>
                {site.address ? (
                  <AppText variant="caption" muted>
                    {site.address}
                  </AppText>
                ) : null}
              </View>
              {selected ? <CheckIcon color={theme.primary} /> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Segmented<Lang>
          label={t('settings.language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'it', label: t('settings.lang.it') },
            { value: 'en', label: t('settings.lang.en') },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('settings.alerts.title')}</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP }}>
          <AppText style={{ flex: 1 }}>{t('settings.alerts.toggle')}</AppText>
          <Switch
            value={prefs?.optIn ?? false}
            disabled={!prefs || (!canOfferAlerts && !prefs.optIn)}
            onValueChange={(next) => void toggleAlerts(next)}
            accessibilityLabel={t('settings.alerts.toggle')}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        {prefs && !canOfferAlerts && !prefs.optIn ? <AppText muted>{t('settings.alerts.later')}</AppText> : null}
        {alertNotice ? <Banner message={t(alertNotice === 'denied' ? 'settings.alerts.denied' : 'settings.alerts.unsupported')} /> : null}
        {prefs?.optIn ? (
          <View style={{ gap: spacing.sm }}>
            <AppText style={{ fontWeight: '600' }}>{t('settings.alerts.window')}</AppText>
            <Segmented<AlertPreset>
              label={t('settings.alerts.window')}
              value={presetOf(prefs.window) ?? DEFAULT_ALERT_PRESET}
              onChange={(p) => void chooseWindow(p)}
              options={(Object.keys(ALERT_PRESETS) as AlertPreset[]).map((p) => ({
                value: p,
                label: `${t(`settings.alerts.preset.${p}`)} ${ALERT_PRESETS[p].from}–${ALERT_PRESETS[p].to}`,
              }))}
            />
          </View>
        ) : null}
        <AppText variant="caption" muted>
          {t('settings.alerts.help')}
        </AppText>
      </Card>

      <Card>
        <SectionTitle>{t('settings.delete.title')}</SectionTitle>
        <AppText muted>{t('settings.delete.body')}</AppText>
        <Button label={t('settings.delete.button')} variant="danger" onPress={() => setConfirmingDelete(true)} />
      </Card>

      <Card>
        <SectionTitle>{t('settings.demo.title')}</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP }}>
          <AppText style={{ flex: 1 }}>{t('settings.demo.toggle')}</AppText>
          <Switch
            value={showDemo}
            disabled={__DEV__}
            onValueChange={setDemoMode}
            accessibilityLabel={t('settings.demo.toggle')}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        {showDemo && demo ? <Button label={t('settings.demo.open')} variant="secondary" onPress={() => router.push('/demo')} /> : null}
      </Card>

      <Card>
        <SectionTitle>{t('settings.privacy.title')}</SectionTitle>
        <AppText muted>{t('settings.privacy.body')}</AppText>
      </Card>

      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <AppText variant="caption" muted>
          {t('settings.about.version', { v: version })}
        </AppText>
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          {t('settings.about.demoNotice')}
        </AppText>
      </View>

      <ConfirmDialog
        visible={confirmingDelete}
        title={t('settings.delete.confirm.title')}
        message={t('settings.delete.confirm.body')}
        confirmLabel={t('settings.delete.confirm.action')}
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void deleteEverything()}
      />
    </Screen>
  );
}

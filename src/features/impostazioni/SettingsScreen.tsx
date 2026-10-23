import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionLabel } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckIcon, MinusIcon, PlusIcon, SlidersIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { ProfileSection } from '@/components/ProfileSection';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SignOutButton } from '@/components/SignOutButton';
import { Toggle } from '@/components/Toggle';
import { useAppState, type ThemePref } from '@/lib/app-state';
import { ALERT_PRESETS, DEFAULT_ALERT_PRESET, presetOf, type AlertPreset, type AlertWindow } from '@/lib/domain/alerts';
import type { WeeklyGoal } from '@/lib/domain/weekly-goal';
import { useI18n, type Lang } from '@/lib/i18n';
import { requestAlertPermission } from '@/lib/notifications';
import { clearSessionCaches } from '@/lib/queries';
import { useApi, useClock } from '@/lib/services-context';
import { useCurrentSite } from '@/lib/sites-context';
import { storage } from '@/lib/storage';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';

interface AlertPrefs {
  optIn: boolean;
  window: AlertWindow;
  /** The member has seen a band at least once (spec §7: only then may we offer notifications). */
  valueSeen: boolean;
}

export function SettingsScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const clock = useClock();
  const { siteId, setSiteId, setLang, sessionCount, themePref, setThemePref, guest, setGuest, resetToInitial } = useAppState();
  const sites = useCurrentSite();

  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [alertNotice, setAlertNotice] = useState<'denied' | 'unsupported' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [weeklyGoal, setWeeklyGoalState] = useState<WeeklyGoal>(3);

  useEffect(() => {
    let alive = true;
    void Promise.all([storage.get('alertOptIn'), storage.get('alertWindow'), storage.get('valueSeen')]).then(([optIn, window, valueSeen]) => {
      if (alive) setPrefs({ optIn: optIn ?? false, window: window ?? ALERT_PRESETS[DEFAULT_ALERT_PRESET], valueSeen: valueSeen ?? false });
    });
    return () => {
      alive = false;
    };
  }, [deleted]);

  useEffect(() => {
    let alive = true;
    void storage.get('weeklyGoal').then((v) => {
      if (alive && v) setWeeklyGoalState(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function setWeeklyGoal(n: WeeklyGoal): Promise<void> {
    setWeeklyGoalState(n);
    await storage.set('weeklyGoal', n);
  }

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
    clock.setOffsetMs(0);
    resetToInitial();
    setPrefs(null);
    setAlertNotice(null);
    setDeleted(true);
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const currentPreset = prefs ? (presetOf(prefs.window) ?? DEFAULT_ALERT_PRESET) : DEFAULT_ALERT_PRESET;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <PageTitle icon={SlidersIcon} label={t('settings.title')} circleSize={22} fontSize={26} />
        <SignOutButton />
      </View>

      {deleted ? (
        <View accessible accessibilityLiveRegion="polite" style={{ borderRadius: 18, paddingVertical: 14, paddingHorizontal: spacing.lg, backgroundColor: theme.band.green.soft }}>
          <AppText color={theme.band.green.onSoft} style={{ fontSize: 14, fontWeight: '500' }}>
            {t('settings.delete.done')}
          </AppText>
        </View>
      ) : null}

      {guest ? (
        <Card>
          <SectionLabel>{t('settings.account.guest.title')}</SectionLabel>
          <AppText muted style={{ fontSize: 14, lineHeight: 21 }}>
            {t('settings.account.guest.body')}
          </AppText>
          {/* Leaving guest mode hands navigation back to the auth flow (root layout guard). */}
          <Button label={t('auth.login.title')} variant="invert" onPress={() => setGuest(false)} />
        </Card>
      ) : (
        <>
          <ProfileSection includeBirthYear />
          <AccountSection />
        </>
      )}

      <Card style={{ padding: 14, gap: spacing.sm }}>
        <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2 }}>
          <SectionLabel>{t('settings.gym')}</SectionLabel>
        </View>
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
                paddingVertical: spacing.md,
                paddingHorizontal: 14,
                borderRadius: 18,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.surfaceAlt : 'transparent',
              }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontSize: 15, fontWeight: '600' }}>{site.name}</AppText>
                {site.address ? (
                  <AppText muted style={{ fontSize: 12, lineHeight: 16 }}>
                    {site.address}
                  </AppText>
                ) : null}
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.primary : 'transparent',
                  borderWidth: 1.5,
                  borderColor: selected ? theme.primary : theme.borderStrong,
                }}>
                {selected ? <CheckIcon color={theme.onPrimary} size={14} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>{t('settings.language')}</SectionLabel>
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
        <SectionLabel>{t('settings.theme.title')}</SectionLabel>
        <Segmented<ThemePref>
          label={t('settings.theme.title')}
          value={themePref}
          onChange={setThemePref}
          options={[
            { value: 'auto', label: t('settings.theme.auto') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />
        <AppText muted style={{ fontSize: 12, lineHeight: 18 }}>
          {t('settings.theme.help')}
        </AppText>
      </Card>

      {/* Tied to the real `checkins` table (`WeeklyGoalPopup.tsx`'s own count of this week's
          check-outs) — the guest/mock flow's check-ins never reach that table, so this card (and the
          popup it configures) is real-Client-only, same scoping as the three removed below. */}
      {!guest ? (
        <Card>
          <SectionLabel>{t('settings.weeklyGoal.title')}</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xs }}>
            <Pressable
              onPress={() => void setWeeklyGoal(Math.max(1, weeklyGoal - 1) as WeeklyGoal)}
              disabled={weeklyGoal <= 1}
              accessibilityRole="button"
              accessibilityLabel={t('settings.weeklyGoal.decrease')}
              style={{
                width: MIN_TAP,
                height: MIN_TAP,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.surfaceAlt,
                opacity: weeklyGoal <= 1 ? 0.4 : 1,
              }}>
              <MinusIcon color={theme.text} size={20} strokeWidth={2.5} />
            </Pressable>

            <View style={{ alignItems: 'center', minWidth: 110 }}>
              <AppText style={{ fontFamily: fontFamily.display, fontSize: 42, lineHeight: 48, color: theme.primary }}>{weeklyGoal}</AppText>
              <AppText muted style={{ fontSize: 13, fontWeight: '600' }}>
                {weeklyGoal === 1 ? t('settings.weeklyGoal.timeSingular') : t('settings.weeklyGoal.times', { n: weeklyGoal })}
              </AppText>
            </View>

            <Pressable
              onPress={() => void setWeeklyGoal(Math.min(5, weeklyGoal + 1) as WeeklyGoal)}
              disabled={weeklyGoal >= 5}
              accessibilityRole="button"
              accessibilityLabel={t('settings.weeklyGoal.increase')}
              style={{
                width: MIN_TAP,
                height: MIN_TAP,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.primary,
                opacity: weeklyGoal >= 5 ? 0.4 : 1,
              }}>
              <PlusIcon color={theme.onPrimary} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: spacing.md }}>
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <View
                key={n}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: radius.pill,
                  backgroundColor: n <= weeklyGoal ? theme.primary : theme.tickOff,
                }}
              />
            ))}
          </View>

          <AppText muted style={{ fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md }}>
            {t('settings.weeklyGoal.help')}
          </AppText>
        </Card>
      ) : null}

      {/* Local alert prefs, "cancella i miei dati" and the privacy blurb are all guest/demo-flow
          concepts from the original mock-only spec (spec §7's local notification, and a GDPR-style
          wipe of the device's own AsyncStorage — there's no server account to erase that way for a
          guest). A real, authenticated Client has none of this: their data lives in a real account,
          not this device's local storage, so these three cards are guest-only — removed from a real
          Client's Impostazioni on request, the guest/demo path (still spec-compliant) is untouched. */}
      {guest ? (
        <>
          <Card>
            <SectionLabel>{t('settings.alerts.title')}</SectionLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP }}>
              <AppText style={{ flex: 1, fontWeight: '500' }}>{t('settings.alerts.toggle')}</AppText>
              <Toggle
                value={prefs?.optIn ?? false}
                disabled={!prefs || (!canOfferAlerts && !prefs.optIn)}
                onValueChange={(next) => void toggleAlerts(next)}
                accessibilityLabel={t('settings.alerts.toggle')}
              />
            </View>
            {prefs && !canOfferAlerts && !prefs.optIn ? (
              <AppText muted style={{ fontSize: 14 }}>
                {t('settings.alerts.later')}
              </AppText>
            ) : null}
            {alertNotice ? <Banner message={t(alertNotice === 'denied' ? 'settings.alerts.denied' : 'settings.alerts.unsupported')} /> : null}
            {prefs?.optIn ? (
              <View style={{ gap: spacing.sm }}>
                <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('settings.alerts.window')}</AppText>
                <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.alerts.window')} style={{ flexDirection: 'row', gap: 6 }}>
                  {(Object.keys(ALERT_PRESETS) as AlertPreset[]).map((p) => {
                    const selected = p === currentPreset;
                    const range = `${ALERT_PRESETS[p].from}–${ALERT_PRESETS[p].to}`;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => void chooseWindow(p)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, checked: selected }}
                        accessibilityLabel={`${t(`settings.alerts.preset.${p}`)} ${range}`}
                        style={{
                          flex: 1,
                          minHeight: MIN_TAP + 8,
                          borderRadius: 16,
                          paddingVertical: 10,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          backgroundColor: selected ? theme.primary : theme.surfaceAlt,
                        }}>
                        <AppText color={selected ? theme.onPrimary : theme.textMuted} style={{ fontSize: 13, lineHeight: 17, fontWeight: '700' }}>
                          {t(`settings.alerts.preset.${p}`)}
                        </AppText>
                        <AppText
                          color={selected ? theme.onPrimary : theme.textMuted}
                          style={{ fontFamily: fontFamily.mono, fontSize: 10, lineHeight: 13, opacity: 0.85 }}>
                          {range}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <AppText muted style={{ fontSize: 12, lineHeight: 18 }}>
              {t('settings.alerts.help')}
            </AppText>
          </Card>

          <Card>
            <SectionLabel>{t('settings.delete.title')}</SectionLabel>
            <AppText muted style={{ fontSize: 14, lineHeight: 21 }}>
              {t('settings.delete.body')}
            </AppText>
            <Button label={t('settings.delete.button')} variant="dangerSoft" onPress={() => setConfirmingDelete(true)} />
          </Card>

          <Card style={{ gap: 10 }}>
            <SectionLabel>{t('settings.privacy.title')}</SectionLabel>
            <AppText muted style={{ fontSize: 13, lineHeight: 20 }}>
              {t('settings.privacy.body')}
            </AppText>
          </Card>
        </>
      ) : null}

      <View style={{ gap: spacing.xs, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 20 }}>
        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15 }}>
          {t('settings.about.version', { v: version })}
        </AppText>
        {guest ? (
          <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
            {t('settings.about.demoNotice')}
          </AppText>
        ) : null}
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

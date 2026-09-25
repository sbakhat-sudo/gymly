import { useRouter } from 'expo-router';
import { useSyncExternalStore, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAppState } from '@/lib/app-state';
import type { MockScenario } from '@/lib/api/demo';
import { computeSimulationOffsetMs, formatTime, localTime } from '@/lib/domain/time';
import { useNow } from '@/lib/hooks';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { sendGreenAlert } from '@/lib/notifications';
import { useApi, useClock, useDemoControls } from '@/lib/services-context';
import { useCurrentSite } from '@/lib/sites-context';
import { storage } from '@/lib/storage';
import { MIN_TAP, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { Segmented } from '@/components/Segmented';
import type { Weekday } from '@/schemas';

const TIME_PRESETS: { key: TranslationKey; weekday: Weekday; minutes: number }[] = [
  { key: 'demo.time.mon0730', weekday: 0, minutes: 7 * 60 + 30 },
  { key: 'demo.time.mon1830', weekday: 0, minutes: 18 * 60 + 30 },
  { key: 'demo.time.tue1830', weekday: 1, minutes: 18 * 60 + 30 },
  { key: 'demo.time.mon2130', weekday: 0, minutes: 21 * 60 + 30 },
  { key: 'demo.time.sat1100', weekday: 5, minutes: 11 * 60 },
  { key: 'demo.time.mon0300', weekday: 0, minutes: 3 * 60 },
];

/** Walk through every state of the spec without a backend. Only reachable in development or with "Modalità demo". */
export function DemoScreen() {
  const demo = useDemoControls();
  const { t } = useI18n();
  if (!demo) {
    return (
      <Screen>
        <Banner title={t('demo.title')} />
      </Screen>
    );
  }
  return <DemoPanel />;
}

function DemoPanel() {
  const demo = useDemoControls();
  const { t, lang, band: bandLabel, weekdayShort } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const api = useApi();
  const clock = useClock();
  const { memberSiteId, setMemberSiteId, setSessionCount } = useAppState();
  const { site } = useCurrentSite();
  const now = useNow(1000);

  const scenario = useSyncExternalStore(
    (l) => demo?.subscribe(l) ?? (() => undefined),
    () => demo?.getScenario() as MockScenario
  );
  const [notice, setNotice] = useState<string | null>(null);
  const offset = useSyncExternalStore(clock.subscribe, clock.offsetMs);

  const redemptions = useAsync(() => api.getRedemptions(), [api, scenario, memberSiteId], memberSiteId !== null);
  const pending = redemptions.data?.redemptions.filter((r) => r.status === 'pending') ?? [];

  if (!demo) return null;
  const set = (patch: Partial<MockScenario>): void => demo.setScenario(patch);
  const linked = site !== undefined && memberSiteId === site.site_id;
  const local = site ? localTime(new Date(now), site.timezone) : null;

  async function setLinked(next: boolean): Promise<void> {
    if (!site) return;
    try {
      if (next) {
        await api.linkMember(site.site_id, 'DEMO1234');
        setMemberSiteId(site.site_id);
      } else {
        await api.unlinkMember();
        setMemberSiteId(null);
      }
    } catch {
      setNotice(t('common.loadError'));
    }
  }

  async function fireAlert(): Promise<void> {
    if (!site) return;
    if ((await storage.get('alertOptIn')) !== true) {
      setNotice(t('demo.notifications.needOptIn'));
      return;
    }
    setNotice(t((await sendGreenAlert(lang, site.name)) ? 'demo.notifications.sent' : 'demo.notifications.notSent'));
  }

  async function unlockSecondSession(): Promise<void> {
    setSessionCount(2);
    await storage.set('valueSeen', true);
    setNotice(t('demo.done'));
  }

  const bandOptions = [
    { value: 'auto', label: t('demo.band.auto') },
    { value: 'green', label: bandLabel('green') },
    { value: 'amber', label: bandLabel('amber') },
    { value: 'red', label: bandLabel('red') },
  ] as const;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppText variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
          {t('demo.title')}
        </AppText>
        <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
      </View>
      <AppText muted>{t('demo.intro')}</AppText>
      {notice ? <Banner message={notice} /> : null}

      <Card>
        <SectionTitle>{t('demo.confidence')}</SectionTitle>
        <Segmented
          label={t('demo.confidence')}
          value={scenario.confidence}
          onChange={(confidence) => set({ confidence })}
          options={[
            { value: 'auto', label: t('demo.confidence.auto') },
            { value: 'high', label: t('demo.confidence.high') },
            { value: 'medium', label: t('demo.confidence.medium') },
            { value: 'low', label: t('demo.confidence.low') },
            { value: 'unavailable', label: t('demo.confidence.unavailable') },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('demo.band')}</SectionTitle>
        <Segmented label={t('demo.band')} value={scenario.band} onChange={(band) => set({ band })} options={bandOptions} />
      </Card>

      <Card>
        <SectionTitle>{t('demo.data')}</SectionTitle>
        <ToggleRow label={t('demo.data.stale')} value={scenario.staleSeconds !== null} onChange={(on) => set({ staleSeconds: on ? 600 : null })} />
        <ToggleRow label={t('demo.data.offline')} value={scenario.offline} onChange={(offline) => set({ offline })} />
        <ToggleRow label={t('demo.data.adapterDown')} value={scenario.adapterDown} onChange={(adapterDown) => set({ adapterDown })} />
        <ToggleRow label={t('demo.data.corrupt')} value={scenario.corruptPayload} onChange={(corruptPayload) => set({ corruptPayload })} />
      </Card>

      <Card>
        <SectionTitle>{t('demo.zones')}</SectionTitle>
        <Segmented
          label={t('demo.zones')}
          value={scenario.zones}
          onChange={(zones) => set({ zones })}
          options={[
            { value: 'auto', label: t('demo.zones.auto') },
            { value: 'on', label: t('demo.zones.on') },
            { value: 'off', label: t('demo.zones.off') },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('demo.member')}</SectionTitle>
        {site && !site.capabilities.points ? (
          <AppText muted>{t('demo.member.unavailable')}</AppText>
        ) : (
          <Segmented
            label={t('demo.member')}
            value={linked ? 'linked' : 'unlinked'}
            onChange={(v) => void setLinked(v === 'linked')}
            options={[
              { value: 'linked', label: t('demo.member.linked') },
              { value: 'unlinked', label: t('demo.member.unlinked') },
            ]}
          />
        )}
      </Card>

      <Card>
        <SectionTitle>{t('demo.time')}</SectionTitle>
        {local ? (
          <AppText muted>
            {offset === 0 ? t('demo.time.real') : t('demo.time.now', { when: `${weekdayShort(local.weekday)} ${formatTime(local.minutes)}` })}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('demo.time.real')} variant={offset === 0 ? 'primary' : 'secondary'} onPress={() => clock.setOffsetMs(0)} />
          {TIME_PRESETS.map((p) => (
            <Button
              key={p.key}
              label={t(p.key)}
              variant="secondary"
              disabled={!site}
              onPress={() => {
                if (!site) return;
                // Offset is relative to the un-shifted clock, so presets don't stack on each other.
                const unshifted = new Date(clock.now().getTime() - clock.offsetMs());
                clock.setOffsetMs(computeSimulationOffsetMs(unshifted, p.weekday, p.minutes, site.timezone));
              }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{t('demo.notifications')}</SectionTitle>
        <Button label={t('demo.notifications.second')} variant="secondary" onPress={() => void unlockSecondSession()} />
        <Button label={t('demo.notifications.fire')} variant="secondary" onPress={() => void fireAlert()} />
      </Card>

      <Card>
        <SectionTitle>{t('demo.redemptions')}</SectionTitle>
        {pending.length === 0 ? <AppText muted>{t('demo.redemptions.empty')}</AppText> : null}
        {pending.map((r) => (
          <View key={r.id} style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: spacing.sm }}>
            <AppText style={{ fontWeight: '700' }}>{r.reward_title}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Button
                label={t('demo.redemptions.validate')}
                variant="secondary"
                onPress={() => void demo.validateRedemption(r.id).then(redemptions.reload)}
              />
              <Button
                label={t('demo.redemptions.expire')}
                variant="secondary"
                onPress={() => void demo.expireRedemption(r.id).then(redemptions.reload)}
              />
            </View>
          </View>
        ))}
      </Card>

      <Button
        label={t('demo.reset')}
        variant="danger"
        onPress={() => {
          demo.resetScenario();
          clock.setOffsetMs(0);
          setNotice(null);
        }}
      />
    </Screen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP }}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: theme.primary, false: theme.border }} />
    </View>
  );
}

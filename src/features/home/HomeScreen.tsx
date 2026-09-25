import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandBadge } from '@/components/BandBadge';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { ClockIcon, StarIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { useAppState } from '@/lib/app-state';
import { nextGreenWindow } from '@/lib/domain/green-window';
import { resolveHomeState } from '@/lib/domain/home-state';
import { bucketOfMinutes, localTime, openStatus } from '@/lib/domain/time';
import { describeNextOpening } from '@/lib/format';
import { useAppActive, useDemoRevision, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useForecast } from '@/lib/queries';
import { useApi } from '@/lib/services-context';
import { useCurrentSite } from '@/lib/sites-context';
import { storage } from '@/lib/storage';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { SiteSummary } from '@/schemas';

import { HomeHero, type HeroView } from './HomeHero';
import { useGreenAlert } from './use-green-alert';
import { useOccupancy } from './use-occupancy';

/** Home tab: the gym picker until a gym is chosen, then the live view of that gym. */
export function HomeScreen() {
  const current = useCurrentSite();
  if (current.site) return <HomeContent site={current.site} />;
  return (
    <Screen>
      <GymGate>{() => null}</GymGate>
    </Screen>
  );
}

function HomeContent({ site }: { site: SiteSummary }) {
  const { t, lang, duration, band: bandLabel, weekday } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const router = useRouter();
  const { memberSiteId } = useAppState();

  // Refresh only while the app is in the foreground AND this tab is visible.
  const appActive = useAppActive();
  const focused = useIsFocused();
  const running = appActive && focused;
  const revision = useDemoRevision();
  const now = useNow(1000, running); // drives "aggiornato X secondi fa"
  const occupancy = useOccupancy(site.site_id, running, revision);
  const [pulling, setPulling] = useState(false);

  const local = localTime(new Date(now), site.timezone);
  const open = openStatus(site.opening_hours, local.weekday, local.minutes);
  const state = resolveHomeState({
    occupancy: occupancy.occupancy,
    source: occupancy.source,
    nowMs: now,
    stalenessLimitS: site.staleness_limit_s,
  });

  // The forecast is only fetched when the live reading cannot carry the screen (still cached for the session).
  const forecast = useForecast(site.site_id, local.weekday, open.open && state.mode !== 'live');
  const currentBucket = bucketOfMinutes(local.minutes);
  const forecastBand = forecast.data?.buckets.find((b) => b.bucket === currentBucket)?.band;

  // The member has now seen real value: the notification opt-in may be offered from the next session.
  const sawValue = state.mode === 'live' || state.mode === 'stale';
  useEffect(() => {
    if (sawValue) void storage.set('valueSeen', true);
  }, [sawValue]);

  // Local "quiet now" alert, only from a fresh live green reading.
  useGreenAlert(
    state.mode === 'live' && state.band === 'green' && !state.offline && occupancy.occupancy?.status === 'ok'
      ? occupancy.occupancy.observed_at
      : null,
    site,
    lang
  );

  const linked = memberSiteId === site.site_id && site.capabilities.points;
  const points = useAsync(() => api.getPoints(), [api, linked, revision], linked);

  const loadingFirst = occupancy.loading && occupancy.occupancy === null;
  const offlineNoData = occupancy.failure === 'offline' && occupancy.occupancy === null;
  const view: HeroView = loadingFirst
    ? { kind: 'loading' }
    : !open.open
      ? {
          kind: 'closed',
          reopens: describeNextOpening(open, local.weekday, {
            weekday,
            todayAt: (time) => t('time.todayAt', { time }),
            dayAt: (day, time) => t('time.dayAt', { day, time }),
          }),
        }
      : { kind: 'data', state, forecastBand, offlineNoData };

  // "Prossima finestra libera": from the payload when live, otherwise derived from the forecast.
  const window =
    view.kind !== 'data'
      ? null
      : state.mode === 'live'
        ? (state.nextGreenWindow ?? null)
        : forecast.data
          ? nextGreenWindow(forecast.data.buckets, local.minutes)
          : null;
  const showNoWindow = view.kind === 'data' && window === null && (state.mode === 'live' || forecast.data !== undefined);

  const metaParts: string[] = [];
  if (view.kind === 'data' && (state.mode === 'live' || state.mode === 'stale')) {
    metaParts.push(t('time.updated', { ago: duration(state.ageS) }));
    if (state.mode === 'live' && state.accuracyNote) metaParts.push(t('time.accuracy', { value: state.accuracyNote }));
  }

  return (
    <Screen
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        void occupancy.refresh().finally(() => setPulling(false));
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          {site.name}
        </AppText>
        {linked && points.data ? (
          <Pressable
            onPress={() => router.push('/punti')}
            accessibilityRole="button"
            accessibilityLabel={t('home.pointsChip.a11y', { n: points.data.balance })}
            style={{
              minHeight: MIN_TAP,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: theme.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <StarIcon color={theme.text} size={18} />
            <AppText style={{ fontWeight: '700' }}>{t('home.pointsChip', { n: points.data.balance })}</AppText>
          </Pressable>
        ) : null}
      </View>

      {occupancy.source === 'cache' && occupancy.failure === 'offline' && occupancy.occupancy !== null ? (
        <Banner title={t('state.offline')} message={t('state.offlineDetail')} />
      ) : null}

      <HomeHero view={view} />

      {metaParts.length > 0 ? (
        <AppText muted accessibilityLabel={metaParts.join(', ')} style={{ textAlign: 'center' }}>
          {metaParts.join(' · ')}
        </AppText>
      ) : null}

      {view.kind === 'data' && state.mode === 'live' && state.zones.length > 0 ? (
        <Card>
          <AppText variant="title" accessibilityRole="header">
            {t('home.zones')}
          </AppText>
          {state.zones.map((zone) => (
            <View
              key={zone.zone_id}
              accessible
              accessibilityLabel={`${zone.name}: ${state.approximate ? '~' : ''}${bandLabel(zone.band)}`}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP, gap: spacing.md }}>
              <AppText style={{ flexShrink: 1 }}>{zone.name}</AppText>
              <BandBadge band={zone.band} approximate={state.approximate} />
            </View>
          ))}
        </Card>
      ) : null}

      {window ? (
        <Card>
          <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ClockIcon color={theme.text} size={24} />
            <AppText style={{ flex: 1, fontWeight: '600' }}>
              {t('home.nextGreen', { from: window.from, to: window.to === '24:00' ? t('time.closing') : window.to })}
            </AppText>
          </View>
          {state.mode !== 'live' ? (
            <AppText variant="caption" muted>
              {t('state.forecast')}
            </AppText>
          ) : null}
        </Card>
      ) : showNoWindow ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {t('home.noGreen')}
        </AppText>
      ) : null}

      {view.kind === 'data' && state.mode === 'live' && state.approximate ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          {t('state.approxLegend')}
        </AppText>
      ) : null}
    </Screen>
  );
}

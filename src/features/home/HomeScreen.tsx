import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { Banner } from '@/components/Banner';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { BestMomentCard } from '@/features/orari/BestMomentCard';
import { bestWindowFor } from '@/features/orari/ScheduleParts';
import { nextGreenWindow } from '@/lib/domain/green-window';
import { resolveHomeState } from '@/lib/domain/home-state';
import { bucketOfMinutes, localTime, openStatus } from '@/lib/domain/time';
import { describeNextOpening } from '@/lib/format';
import { useAppActive, useDemoRevision, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useForecast } from '@/lib/queries';
import { useCurrentSite } from '@/lib/sites-context';
import { storage } from '@/lib/storage';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { SiteSummary } from '@/schemas';

import { HomeHero, type HeroView } from './HomeHero';
import { UpcomingStrip } from './UpcomingStrip';
import { useGreenAlert } from './use-green-alert';
import { useOccupancy } from './use-occupancy';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Live tab: the gym picker until a gym is chosen, then the live view of that gym. */
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
  const router = useRouter();

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

  // Fetched whenever the gym is open (session-cached): the live reading uses it as a fallback,
  // and the "prossime ore" strip / "momento migliore" card below the hero need it even when live.
  const forecast = useForecast(site.site_id, local.weekday, open.open);
  const currentBucket = bucketOfMinutes(local.minutes);
  const forecastBand = forecast.data?.buckets.find((b) => b.bucket === currentBucket)?.band;
  // `isToday: false` is deliberate here (even though this IS today): it switches `bestWindowFor` from
  // "best window still ahead" to "longest window of the whole day", so the card still has something
  // useful to say late in the day, after the best window has already passed.
  const closedAllDay = !forecast.data || forecast.data.buckets.length === 0;
  const bestWindowToday = forecast.data ? bestWindowFor(forecast.data.buckets, false, local.minutes) : null;

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
  const meta = metaParts.length > 0 ? metaParts.join(' · ') : null;

  const liveBand = view.kind === 'data' && state.mode === 'live' ? state.band : null;
  const dayName = weekday(local.weekday);
  const clockLabel = `${dayName.charAt(0).toUpperCase()}${dayName.slice(1)} · ${pad(Math.floor(local.minutes / 60))}:${pad(local.minutes % 60)}`;

  return (
    <Screen
      orb={liveBand ? { color: theme.band[liveBand].solid, top: 40, size: 380 } : undefined}
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        void occupancy.refresh().finally(() => setPulling(false));
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Pressable
          onPress={() => router.push('/impostazioni')}
          accessibilityRole="button"
          accessibilityLabel={`${site.name}. ${t('home.changeGym')}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP, flexShrink: 1 }}>
          <LogoMark size={38} bgColor={theme.background} bandColor={liveBand ? theme.band[liveBand].solid : theme.textMuted} />
          <View style={{ flexShrink: 1 }}>
            <AppText muted style={{ fontSize: 11, lineHeight: 14, fontWeight: '500' }}>
              {clockLabel}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppText variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontSize: 36, lineHeight: 41, letterSpacing: 36 * -0.05 }}>
                {site.name}
              </AppText>
              <ChevronDownIcon color={theme.textMuted} size={15} strokeWidth={2.6} />
            </View>
          </View>
        </Pressable>
      </View>

      {occupancy.source === 'cache' && occupancy.failure === 'offline' && occupancy.occupancy !== null ? (
        <Banner title={t('state.offline')} message={t('state.offlineDetail')} />
      ) : null}

      <HomeHero view={view} meta={liveBand ? meta : null} />

      {meta && !liveBand ? (
        <AppText muted accessibilityLabel={metaParts.join(', ')} style={{ textAlign: 'center', fontSize: 12 }}>
          {meta}
        </AppText>
      ) : null}

      {forecast.data ? (
        <BestMomentCard
          window={bestWindowToday}
          title={t('schedule.bestMoment.title')}
          emptyText={closedAllDay ? t('schedule.closedDay') : t('schedule.noFreeWindows')}
          siteName={site.name}
          timezone={site.timezone}
          dateKey={local.dateKey}
        />
      ) : null}

      {open.open && forecast.data ? (
        <View
          style={{
            borderRadius: radius.xl,
            padding: 18,
            gap: spacing.lg,
            backgroundColor: theme.glass,
            borderWidth: 1,
            borderColor: theme.glassBorder,
          }}>
          <AppText accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600' }}>
            {t('home.upcoming')}
          </AppText>
          <UpcomingStrip forecast={forecast.data} currentHour={Math.floor(local.minutes / 60)} />
        </View>
      ) : null}

      {view.kind === 'data' && state.mode === 'live' && state.zones.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {state.zones.map((zone) => {
            const colors = theme.band[zone.band];
            return (
              <View
                key={zone.zone_id}
                accessible
                accessibilityLabel={`${zone.name}: ${state.approximate ? '~' : ''}${bandLabel(zone.band)}`}
                style={{ flexBasis: '46%', flexGrow: 1, borderRadius: radius.card, padding: spacing.lg, gap: 18, backgroundColor: colors.soft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <AppText color={colors.onSoft} numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', flexShrink: 1 }}>
                    {zone.name}
                  </AppText>
                  <BandIcon band={zone.band} size={15} color={colors.solid} />
                </View>
                <AppText
                  color={colors.solid}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontFamily: fontFamily.displaySemi, fontSize: 19, lineHeight: 24, letterSpacing: 19 * -0.04 }}>
                  {state.approximate ? '~' : ''}
                  {bandLabel(zone.band)}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      {window ? (
        <Pressable
          onPress={() => router.push('/orari')}
          accessibilityRole="button"
          style={({ pressed }) => ({
            borderRadius: radius.card,
            paddingVertical: spacing.lg,
            paddingHorizontal: 18,
            backgroundColor: theme.primary,
            gap: spacing.xs,
            opacity: pressed ? 0.9 : 1,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ClockIcon color={theme.onPrimary} size={22} />
            <AppText color={theme.onPrimary} style={{ flex: 1, fontSize: 15, fontWeight: '600' }}>
              {t('home.nextGreen', { from: window.from, to: window.to === '24:00' ? t('time.closing') : window.to })}
            </AppText>
            <ChevronRightIcon color={theme.onPrimary} size={16} strokeWidth={2.2} />
          </View>
          {state.mode !== 'live' ? (
            <AppText variant="caption" color={theme.onPrimary} style={{ opacity: 0.85, marginLeft: 34 }}>
              {t('state.forecast')}
            </AppText>
          ) : null}
        </Pressable>
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

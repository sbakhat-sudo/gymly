import { useIsFocused } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { getMySubscription } from '@/features/billing/billing-api';
import { SubscriptionStatusCard } from '@/features/billing/SubscriptionStatusCard';
import { bestHourToGo, type OpenWindow } from '@/lib/domain/gym-advice';
import { addDays, localTime, parseTime } from '@/lib/domain/time';
import { getSiteStatus, type SiteStatus } from '@/lib/gym-status';
import { getMyCheckins } from '@/lib/checkins-api';
import { useAuth } from '@/lib/auth/auth-context';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { getWeekRealBands, getWeeklyStats } from '@/lib/real-schedule';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { Weekday } from '@/schemas';

import { GoTodayAdviceCard, type GoAdvice } from './GoTodayAdviceCard';
import { MyVisitsCard, type MyVisit } from './MyVisitsCard';
import { ScheduleHeader } from './ScheduleParts';
import { YesterdayBandsCard, type YesterdayHour } from './YesterdayBandsCard';

/** Weeks of real hourly data read: enough to cover the last visits, yesterday and the weekday pattern. */
const WEEKS_BACK = 4;
const VISITS_SHOWN = 8;

/** First/last hour the gym is ever open, across its whole weekly schedule — from real opening hours, never a forecast. */
function openingHourRange(site: Pick<SiteStatus, 'openingHours'>): { first: number; last: number } | null {
  let first = 24;
  let last = -1;
  for (const oh of site.openingHours) {
    const openHour = Math.floor(parseTime(oh.opens_at) / 60);
    const closeHour = Math.ceil(parseTime(oh.closes_at) / 60) - 1;
    if (openHour < first) first = openHour;
    if (closeHour > last) last = closeHour;
  }
  return last < 0 ? null : { first, last };
}

/**
 * A real (approved) Client's "Storico": the app is live now, so this shows only what actually
 * happened (real check-ins) and the real pattern built from them — never a simulated forecast.
 * Percentages are real too: check-ins ÷ the Manager's own `capacity_reference` (see "Gestione
 * Capienza"), computed server-side, never a static example number. Exported so `(client)/orari.tsx`
 * can branch on it.
 */
export function RealClientScheduleScreen({ siteId }: { siteId: string }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const focused = useIsFocused();
  const site = useAsync(() => getSiteStatus(siteId), [siteId]);
  const now = useNow(60_000, focused);

  const timezone = site.data?.timezone ?? 'UTC';
  const local = localTime(new Date(now), timezone);
  const weekStart = addDays(local.dateKey, -local.weekday);

  const recentBands = useAsync(
    () => Promise.all(Array.from({ length: WEEKS_BACK }, (_, i) => getWeekRealBands(siteId, addDays(weekStart, -7 * i)))).then((weeks) => weeks.flat()),
    [siteId, weekStart],
    site.data !== undefined
  );
  const stats = useAsync(() => getWeeklyStats(siteId), [siteId], site.data !== undefined);
  const subscription = useAsync(() => getMySubscription(), [focused], focused);
  const auth = useAuth();
  const userId = 'session' in auth ? auth.session.user.id : null;
  const visits = useAsync(() => (userId ? getMyCheckins(userId, siteId, VISITS_SHOWN) : Promise.resolve([])), [userId, siteId, focused], userId !== null && focused);

  if (site.data === undefined) {
    return (
      <Screen>
        {site.error ? (
          <View style={{ gap: spacing.lg }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={site.reload} />
          </View>
        ) : (
          <ActivityIndicator accessibilityLabel={t('state.loading')} style={{ marginTop: spacing.xxl }} />
        )}
      </Screen>
    );
  }

  const siteData = site.data;
  const range = openingHourRange(siteData);
  const bands = recentBands.data;
  const yesterdayKey = addDays(local.dateKey, -1);

  // Hour-by-hour real bands of the weeks read, looked up by "date:hour".
  const bandAt = new Map((bands ?? []).map((b) => [`${b.dateKey}:${b.hour}`, b.band]));
  const myVisits: MyVisit[] = (visits.data ?? []).map((v) => {
    const start = localTime(new Date(v.checkinAt), timezone);
    const end = v.checkoutAt ? localTime(new Date(v.checkoutAt), timezone) : null;
    return {
      id: v.id,
      dateKey: start.dateKey,
      startMinutes: start.minutes,
      // A visit that runs past midnight is shown as ending at closing time of its own day.
      endMinutes: end === null ? null : end.dateKey === start.dateKey ? end.minutes : 24 * 60 - 1,
      band: bandAt.get(`${start.dateKey}:${Math.floor(start.minutes / 60)}`) ?? null,
    };
  });

  const yesterdayHours: YesterdayHour[] = (bands ?? [])
    .filter((b) => b.dateKey === yesterdayKey)
    .map((b) => ({ hour: b.hour, pct: b.pct, band: b.band }))
    .sort((x, y) => x.hour - y.hour);

  const thresholds = { greenPct: siteData.bandGreenPct, amberPct: siteData.bandAmberPct };
  const windowsFor = (weekday: Weekday): OpenWindow[] =>
    siteData.openingHours.filter((oh) => oh.weekday === weekday).map((oh) => ({ start: parseTime(oh.opens_at), end: parseTime(oh.closes_at) }));
  const weekdayLabel = (dateKey: string): string => {
    const name = new Date(`${dateKey}T12:00:00`).toLocaleDateString(lang, { weekday: 'long' });
    return lang === 'en' ? `${name}s` : name;
  };
  // Today if there is still a good hour left; otherwise tomorrow's best (from the same real history).
  const stats$ = stats.data;
  const todayAdvice = stats$ ? bestHourToGo(stats$, local.weekday, windowsFor(local.weekday), local.minutes, thresholds) : null;
  const tomorrowWeekday = ((local.weekday + 1) % 7) as Weekday;
  const tomorrowAdvice = stats$ && !todayAdvice ? bestHourToGo(stats$, tomorrowWeekday, windowsFor(tomorrowWeekday), -1, thresholds) : null;
  const advice: GoAdvice | null = todayAdvice
    ? { day: 'today', weekdayLabel: weekdayLabel(local.dateKey), ...todayAdvice }
    : tomorrowAdvice
      ? { day: 'tomorrow', weekdayLabel: weekdayLabel(addDays(local.dateKey, 1)), ...tomorrowAdvice }
      : null;

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <ScheduleHeader gymName={siteData.name} subtitle={t('schedule.subtitleReal')} />

        <SubscriptionStatusCard state={subscription.data} />

        {visits.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={visits.reload} />
          </View>
        ) : visits.data === undefined || recentBands.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <MyVisitsCard visits={myVisits} />
        )}

        {stats.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={stats.reload} />
          </View>
        ) : stats.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <GoTodayAdviceCard advice={advice} />
        )}

        {recentBands.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={recentBands.reload} />
          </View>
        ) : bands === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <YesterdayBandsCard hours={yesterdayHours} range={range} />
        )}

        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
          {t('schedule.realNote')}
        </AppText>
      </View>
    </Screen>
  );
}

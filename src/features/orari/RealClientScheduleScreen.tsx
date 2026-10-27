import { useIsFocused } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { MonthCalendarCard } from '@/features/home/client/ClientProgressCards';
import { totalSeconds, visitedDays, weeklyAverage, weeklySummaries } from '@/lib/domain/client-home';
import { addDays, localTime } from '@/lib/domain/time';
import { getSiteStatus } from '@/lib/gym-status';
import { getMyCheckins } from '@/lib/checkins-api';
import { useAuth } from '@/lib/auth/auth-context';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { getWeekRealBands } from '@/lib/real-schedule';
import { spacing, useTheme } from '@/lib/theme';
import { SLOW_REFRESH_MS, useAsync } from '@/lib/use-async';

import { HistoryStatsTiles, WeeklyProgressCard } from './HistoryCards';
import { MyVisitsCard, type MyVisit } from './MyVisitsCard';
import { ScheduleHeader } from './ScheduleParts';

/** Weeks of real hourly data read: enough to cover the last visits, yesterday and the weekday pattern. */
const WEEKS_BACK = 4;
const VISITS_SHOWN = 8;
/** Visits read for the calendar, the weekly comparison, the totals and the usual training time: 300 is about a year of regular use. */
const HISTORY_VISITS = 300;
/** Weeks shown side by side in the weekly chart. */
const CHART_WEEKS = 8;

/**
 * A real (approved) Client's "Storico": the app is live now, so this shows only what actually
 * happened (real check-ins) and the real pattern built from them — never a simulated forecast.
 * Percentages are real too: check-ins ÷ the Manager's own `capacity_reference` (see "Gestione
 * Capienza"), computed server-side, never a static example number. Exported so `(client)/orari.tsx`
 * can branch on it.
 */
export function RealClientScheduleScreen({ siteId }: { siteId: string }) {
  const { t } = useI18n();
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
    site.data !== undefined,
    SLOW_REFRESH_MS
  );
  const auth = useAuth();
  const userId = 'session' in auth ? auth.session.user.id : null;
  const visits = useAsync(() => (userId ? getMyCheckins(userId, siteId, VISITS_SHOWN) : Promise.resolve([])), [userId, siteId, focused], userId !== null && focused);

  const calendarVisits = useAsync(() => (userId ? getMyCheckins(userId, siteId, HISTORY_VISITS) : Promise.resolve([])), [userId, siteId, focused], userId !== null && focused);

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
  const bands = recentBands.data;

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

  const history = calendarVisits.data ?? [];

  // Totals and the week-by-week picture, from the member's own visits.
  const weeks = weeklySummaries(history, timezone, local.dateKey, CHART_WEEKS);
  const earliest = history.reduce<string | null>((min, v) => (min === null || v.checkinAt < min ? v.checkinAt : min), null);

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <ScheduleHeader gymName={siteData.name} subtitle={t('schedule.subtitleReal')} />

        {calendarVisits.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={calendarVisits.reload} />
          </View>
        ) : calendarVisits.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <>
            <HistoryStatsTiles seconds={totalSeconds(history)} weeklyAverage={weeklyAverage(weeks)} visits={history.length} since={earliest ? new Date(earliest) : null} />
            <MonthCalendarCard todayKey={local.dateKey} days={visitedDays(history, timezone)} />
            <WeeklyProgressCard weeks={weeks} />
          </>
        )}

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

        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
          {t('schedule.realNote')}
        </AppText>
      </View>
    </Screen>
  );
}

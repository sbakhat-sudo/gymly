import { useIsFocused } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { getMySubscription } from '@/features/billing/billing-api';
import { SubscriptionStatusCard } from '@/features/billing/SubscriptionStatusCard';
import { addDays, localTime, parseTime } from '@/lib/domain/time';
import { getSiteStatus, type SiteStatus } from '@/lib/gym-status';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { getWeekRealBands, getWeeklyStats, type RealHourBand, type WeeklyStat } from '@/lib/real-schedule';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { Band, Weekday } from '@/schemas';

import { FifteenDayCalendar, type CalendarDay } from './FifteenDayCalendar';
import { RealBestMomentCard } from './RealBestMomentCard';
import { ScheduleHeader } from './ScheduleParts';
import { type HourlyPoint, TodayVsYesterdayChart } from './TodayVsYesterdayChart';

const CALENDAR_DAYS = 15;
/** Enough weekly RPC calls to always cover `today - CALENDAR_DAYS`, even when today is a Monday
 * (the worst case: the current week's own Monday contributes nothing toward the lookback). */
const WEEKS_BACK = 4;

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

/** Today's historically quietest open hour, from the multi-week pattern — a genuine "usually best"
 * answer, not today's own (still-incomplete) real data. `null` if there isn't enough history yet. */
function quietestHourToday(stats: readonly WeeklyStat[], weekday: Weekday, range: { first: number; last: number } | null): { hour: number; pct: number } | null {
  if (!range) return null;
  let best: { hour: number; pct: number } | null = null;
  for (const s of stats) {
    if (s.weekday !== weekday || s.samples === 0 || s.hour < range.first || s.hour > range.last) continue;
    if (!best || s.pct < best.pct) best = { hour: s.hour, pct: s.pct };
  }
  return best;
}

/** A handful of real checkpoints spread across the gym's open hours for one specific past date —
 * early/mid-morning/afternoon/evening, picked by position in the range so a gym open 06:00–14:00
 * gets sensible checkpoints too. A checkpoint hour with no real data for that date is simply
 * skipped, never guessed. */
function checkpointsForDate(dateKey: string, bands: readonly RealHourBand[], range: { first: number; last: number } | null): { hour: number; band: Band }[] {
  if (!range) return [];
  const span = range.last - range.first;
  const checkpointHours = Array.from(new Set([0.1, 0.4, 0.7, 0.95].map((f) => Math.min(range.last, range.first + Math.round(span * f)))));
  const byHour = new Map(bands.filter((b) => b.dateKey === dateKey).map((b) => [b.hour, b.band]));
  const out: { hour: number; band: Band }[] = [];
  for (const hour of checkpointHours) {
    const band = byHour.get(hour);
    if (band) out.push({ hour, band });
  }
  return out;
}

/** Every real hour of one specific date, in order — the continuous line for the "Oggi vs Ieri"
 * chart. Only hours that actually have a real check-in appear; a date with no real data yet returns
 * an empty series rather than a flat guessed line. */
function hourlySeriesForDate(dateKey: string, bands: readonly RealHourBand[], range: { first: number; last: number } | null): HourlyPoint[] {
  if (!range) return [];
  const byHour = new Map(bands.filter((b) => b.dateKey === dateKey).map((b) => [b.hour, b.pct]));
  const out: HourlyPoint[] = [];
  for (let hour = range.first; hour <= range.last; hour++) {
    const pct = byHour.get(hour);
    if (pct !== undefined) out.push({ hour, pct });
  }
  return out;
}

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
    site.data !== undefined
  );
  const stats = useAsync(() => getWeeklyStats(siteId), [siteId], site.data !== undefined);
  const subscription = useAsync(() => getMySubscription(), [focused], focused);

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

  const calendarDays: CalendarDay[] | undefined =
    bands &&
    Array.from({ length: CALENDAR_DAYS }, (_, i) => {
      const dateKey = addDays(local.dateKey, i - CALENDAR_DAYS);
      return { dateKey, checkpoints: checkpointsForDate(dateKey, bands, range) };
    });

  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <ScheduleHeader gymName={siteData.name} subtitle={t('schedule.subtitleReal')} />

        <SubscriptionStatusCard state={subscription.data} />

        {recentBands.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={recentBands.reload} />
          </View>
        ) : calendarDays === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <FifteenDayCalendar days={calendarDays} />
        )}

        {bands ? (
          <TodayVsYesterdayChart today={hourlySeriesForDate(local.dateKey, bands, range)} yesterday={hourlySeriesForDate(yesterdayKey, bands, range)} />
        ) : null}

        {stats.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={stats.reload} />
          </View>
        ) : stats.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <RealBestMomentCard moment={quietestHourToday(stats.data, local.weekday, range)} emptyText={t('schedule.topToday.empty')} />
        )}

        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
          {t('schedule.realNote')}
        </AppText>
      </View>
    </Screen>
  );
}

import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { addDays, localTime, parseTime } from '@/lib/domain/time';
import { getSiteStatus, type SiteStatus } from '@/lib/gym-status';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { getWeekRealBands, getWeeklyStats } from '@/lib/real-schedule';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { Band, Weekday } from '@/schemas';

import { RealDayChart } from './RealDayChart';
import { RealDayPills } from './RealDayPills';
import { ScheduleLegend } from './ScheduleLegend';
import { DayChartCard, ScheduleHeader } from './ScheduleParts';
import { WeeklyStats } from './WeeklyStats';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];

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
 * A real (approved) Client's Orari tab: the app is live now, so this shows only what actually
 * happened — real check-ins, never a simulated forecast. The selected day's hour-by-hour chart stops
 * at "now" (today) or covers the whole day (a real past day); a day that hasn't come yet can't even
 * be opened. Below it, a weekly statistics card shows the historical pattern across several weeks —
 * clearly a pattern, not a claim about any one date. Exported so `(client)/orari.tsx` can branch on it.
 */
export function RealClientScheduleScreen({ siteId }: { siteId: string }) {
  const { t, weekday } = useI18n();
  const theme = useTheme();
  const focused = useIsFocused();
  const site = useAsync(() => getSiteStatus(siteId), [siteId]);
  const now = useNow(30_000, focused);
  const [selected, setSelected] = useState<Weekday | null>(null);

  // Before `site` loads there is no real timezone yet; 'UTC' is only a placeholder for this render
  // (the two fetches below stay disabled until `site.data` exists, so it never drives a real request).
  const timezone = site.data?.timezone ?? 'UTC';
  const local = localTime(new Date(now), timezone);
  const weekStart = addDays(local.dateKey, -local.weekday);

  const weekBands = useAsync(() => getWeekRealBands(siteId, weekStart), [siteId, weekStart], site.data !== undefined);
  const stats = useAsync(() => getWeeklyStats(siteId), [siteId], site.data !== undefined);

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
  const dates = WEEKDAYS.map((d) => addDays(weekStart, d));
  // Storico shows only completed days — defaults to the most recent one (yesterday). On a Monday
  // there is no past day left in this fixed Mon–Sun strip (see RealDayPills' own `day >= today`
  // disabling), so it falls back to today rather than pointing at a day with no data yet.
  const selectedDay = selected ?? ((local.weekday > 0 ? local.weekday - 1 : local.weekday) as Weekday);
  const selectedDateKey = dates[selectedDay] ?? local.dateKey;
  const range = openingHourRange(siteData);
  const isToday = selectedDay === local.weekday;
  const nowHour = isToday ? Math.floor(local.minutes / 60) : null;

  const dateBands = new Map<number, Band>();
  for (const b of weekBands.data ?? []) if (b.dateKey === selectedDateKey) dateBands.set(b.hour, b.band);

  return (
    <Screen>
      <View style={{ gap: 14 }}>
        <ScheduleHeader gymName={siteData.name} subtitle={t('schedule.subtitleReal')} />

        {weekBands.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={weekBands.reload} />
          </View>
        ) : weekBands.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <>
            <RealDayPills dates={dates} bands={weekBands.data} selectedDay={selectedDay} onSelectDay={setSelected} today={local.weekday} />
            {range ? (
              <DayChartCard dayName={weekday(selectedDay)} span={`${String(range.first).padStart(2, '0')}–${String(range.last + 1).padStart(2, '0')}`} title={t('schedule.dayCard.titleReal')}>
                <RealDayChart key={selectedDay} day={selectedDay} dateBands={dateBands} openingHours={siteData.openingHours} firstHour={range.first} lastHour={range.last} nowHour={nowHour} />
                <ScheduleLegend />
              </DayChartCard>
            ) : null}
          </>
        )}

        {stats.error ? (
          <View style={{ gap: spacing.sm }}>
            <Banner title={t('schedule.error')} />
            <Button label={t('common.retry')} onPress={stats.reload} />
          </View>
        ) : stats.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('state.loading')} />
        ) : (
          <WeeklyStats stats={stats.data} />
        )}

        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
          {t('schedule.realNote')}
        </AppText>
      </View>
    </Screen>
  );
}

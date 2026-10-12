import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { useAppState } from '@/lib/app-state';
import { allGreenWindows } from '@/lib/domain/green-window';
import { visibleHours } from '@/lib/domain/heatmap';
import { modalArrival, personalSuggestion } from '@/lib/domain/suggestion';
import { bucketLabel, localTime } from '@/lib/domain/time';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useWeekForecast } from '@/lib/queries';
import { useApi } from '@/lib/services-context';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { SiteSummary, Weekday } from '@/schemas';

import { DayBarChart } from './DayBarChart';
import { DayPills } from './DayPills';
import { FreeWindowsList } from './FreeWindowsList';
import { ScheduleLegend } from './ScheduleLegend';
import { bestWindowFor, DayChartCard, PerTeCard, ScheduleHeader } from './ScheduleParts';

export function ScheduleScreen() {
  return (
    <Screen>
      <GymGate>{(site) => <ScheduleContent site={site} />}</GymGate>
    </Screen>
  );
}

function ScheduleContent({ site }: { site: SiteSummary }) {
  const { t, weekday } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const { memberSiteId } = useAppState();
  const focused = useIsFocused();
  const now = useNow(30_000, focused);
  const local = localTime(new Date(now), site.timezone);
  const [selected, setSelected] = useState<Weekday | null>(null);
  // Storico shows only completed days — defaults to the most recent one (yesterday). On a Monday
  // there is no past day left in this fixed Mon–Sun strip (see DayPills' own `day >= today` disabling),
  // so it falls back to today rather than pointing at a day that doesn't exist in this week's data.
  const selectedDay = selected ?? ((local.weekday > 0 ? local.weekday - 1 : local.weekday) as Weekday);

  const week = useWeekForecast(site.site_id);
  const linked = memberSiteId === site.site_id && site.capabilities.points;
  const arrivals = useAsync(() => api.getArrivalHistory(), [api, linked], linked);

  if (week.data === undefined) {
    return week.error ? (
      <View style={{ gap: spacing.lg }}>
        <Banner title={t('schedule.error')} />
        <Button label={t('common.retry')} onPress={week.reload} />
      </View>
    ) : (
      <ActivityIndicator accessibilityLabel={t('state.loading')} style={{ marginTop: spacing.xxl }} />
    );
  }

  const range = visibleHours(week.data.map((d) => d.buckets));
  const habit = arrivals.data ? modalArrival(arrivals.data.arrivals) : null;
  const habitDay = habit ? week.data[habit.weekday] : undefined;
  const suggestion = habit && habitDay ? personalSuggestion(habit.bucket, habitDay.buckets) : null;
  const detail = week.data[selectedDay];
  const isToday = selectedDay === local.weekday;
  const nowHour = isToday ? Math.floor(local.minutes / 60) : null;
  // Still computed (not shown as a card any more) purely to pick which hour the detail chart opens
  // scrolled to — the day's own quietest stretch is still the most useful first thing to see.
  const bestWindow = detail ? bestWindowFor(detail.buckets, isToday, local.minutes) : null;
  const freeWindows = detail ? allGreenWindows(detail.buckets) : [];
  const closedAllDay = !detail || detail.buckets.length === 0;

  return (
    <View style={{ gap: 14 }}>
      <ScheduleHeader gymName={site.name} />

      <DayPills week={week.data} selectedDay={selectedDay} onSelectDay={setSelected} today={local.weekday} />

      {detail && range && !closedAllDay ? (
        <DayChartCard
          dayName={weekday(selectedDay)}
          span={`${String(range.first).padStart(2, '0')}–${String(range.last + 1).padStart(2, '0')}`}>
          <DayBarChart
            key={selectedDay}
            day={selectedDay}
            buckets={detail.buckets}
            firstHour={range.first}
            lastHour={range.last}
            nowHour={nowHour}
            habitHour={habit && habit.weekday === selectedDay ? Math.floor(habit.bucket / 4) : null}
            initialHour={bestWindow ? Number(bestWindow.from.slice(0, 2)) : null}
          />
          <ScheduleLegend />
        </DayChartCard>
      ) : null}

      {detail && !closedAllDay ? (
        <FreeWindowsList day={selectedDay} windows={freeWindows} />
      ) : null}

      {habit && suggestion ? (
        <PerTeCard
          text={t('schedule.suggestion', {
            day: weekday(habit.weekday),
            time: bucketLabel(habit.bucket),
            alt: bucketLabel(suggestion.alternativeBucket),
            pct: suggestion.lessPercent,
          })}
        />
      ) : null}

      <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
        {t('schedule.note')}
      </AppText>
    </View>
  );
}

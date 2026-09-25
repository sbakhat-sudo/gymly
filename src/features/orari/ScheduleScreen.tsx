import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { useAppState } from '@/lib/app-state';
import { visibleHours } from '@/lib/domain/heatmap';
import { modalArrival, personalSuggestion } from '@/lib/domain/suggestion';
import { bucketLabel, localTime } from '@/lib/domain/time';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useWeekForecast } from '@/lib/queries';
import { useApi } from '@/lib/services-context';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { Band, SiteSummary, Weekday } from '@/schemas';

import { DayDetail } from './DayDetail';
import { HeatmapGrid } from './HeatmapGrid';

export function ScheduleScreen() {
  return (
    <Screen>
      <GymGate>{(site) => <ScheduleContent site={site} />}</GymGate>
    </Screen>
  );
}

function ScheduleContent({ site }: { site: SiteSummary }) {
  const { t, weekday, band: bandLabel } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const { memberSiteId } = useAppState();
  const focused = useIsFocused();
  const now = useNow(30_000, focused);
  const local = localTime(new Date(now), site.timezone);
  const [selected, setSelected] = useState<Weekday | null>(null);
  const selectedDay = selected ?? local.weekday;

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

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('schedule.title')}
        </AppText>
        <AppText muted>{t('schedule.subtitle')}</AppText>
      </View>

      {habit && suggestion ? (
        <Card>
          <AppText variant="title" accessibilityRole="header">
            {t('schedule.suggestion.title')}
          </AppText>
          <AppText>
            {t('schedule.suggestion', {
              day: weekday(habit.weekday),
              time: bucketLabel(habit.bucket),
              alt: bucketLabel(suggestion.alternativeBucket),
              pct: suggestion.lessPercent,
            })}
          </AppText>
        </Card>
      ) : null}

      <Card>
        {range ? (
          <HeatmapGrid
            week={week.data}
            firstHour={range.first}
            lastHour={range.last}
            selectedDay={selectedDay}
            onSelectDay={setSelected}
            now={{ weekday: local.weekday, hour: Math.floor(local.minutes / 60) }}
            habit={habit ? { weekday: habit.weekday, hour: Math.floor(habit.bucket / 4) } : null}
          />
        ) : (
          <AppText muted>{t('schedule.closedDay')}</AppText>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {(['green', 'amber', 'red'] as const).map((band) => (
              <LegendBand key={band} band={band} label={bandLabel(band)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <LegendSwatch label={t('schedule.legend.closed')}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.textMuted }} />
            </LegendSwatch>
            <LegendSwatch label={t('schedule.legend.now')}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 3, borderColor: theme.text }} />
            </LegendSwatch>
            {habit ? (
              <LegendSwatch label={t('schedule.legend.habit')}>
                <AppText style={{ fontSize: 16, fontWeight: '800', lineHeight: 18 }}>★</AppText>
              </LegendSwatch>
            ) : null}
          </View>
        </View>
      </Card>

      {detail ? <DayDetail day={selectedDay} forecast={detail} /> : null}

      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        {t('schedule.note')}
      </AppText>
    </View>
  );
}

function LegendBand({ band, label }: { band: Band; label: string }) {
  const theme = useTheme();
  const colors = theme.band[band];
  return (
    <LegendSwatch label={label}>
      <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: colors.solid, alignItems: 'center', justifyContent: 'center' }}>
        <BandIcon band={band} size={13} color={colors.onSolid} />
      </View>
    </LegendSwatch>
  );
}

function LegendSwatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
      {children}
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

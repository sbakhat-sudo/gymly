import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandBadge } from '@/components/BandBadge';
import { Card } from '@/components/Card';
import { allGreenWindows } from '@/lib/domain/green-window';
import { hourlyBands } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, spacing, useTheme } from '@/lib/theme';
import type { Forecast, Weekday } from '@/schemas';

/** Hour-by-hour detail of the selected day, plus its free windows. Plain text, so it reads well with a screen reader. */
export function DayDetail({ day, forecast }: { day: Weekday; forecast: Forecast }) {
  const { t, weekday, band: bandLabel } = useI18n();
  const theme = useTheme();
  const bands = hourlyBands(forecast.buckets);
  const windows = allGreenWindows(forecast.buckets);
  const openHours = bands.map((band, hour) => ({ band, hour })).filter((h) => h.band !== null);

  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">
        {t('schedule.detail', { day: weekday(day) })}
      </AppText>

      {openHours.length === 0 ? (
        <AppText muted>{t('schedule.closedDay')}</AppText>
      ) : (
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ fontWeight: '700' }}>{t('schedule.freeWindows')}</AppText>
            {windows.length === 0 ? (
              <AppText muted>{t('schedule.noFreeWindows')}</AppText>
            ) : (
              windows.map((w) => (
                <AppText key={w.from} muted>
                  {w.from}–{w.to === '24:00' ? t('time.closing') : w.to}
                </AppText>
              ))
            )}
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText style={{ fontWeight: '700' }}>{t('schedule.hourly')}</AppText>
            {openHours.map(({ band, hour }) =>
              band ? (
                <View
                  key={hour}
                  accessible
                  accessibilityLabel={t('schedule.cellA11y', {
                    day: weekday(day),
                    hour: `${String(hour).padStart(2, '0')}:00`,
                    band: bandLabel(band),
                  })}
                  style={{
                    minHeight: MIN_TAP - 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                    gap: spacing.md,
                  }}>
                  <AppText style={{ fontVariant: ['tabular-nums'] }}>{String(hour).padStart(2, '0')}:00</AppText>
                  <BandBadge band={band} forecast />
                </View>
              ) : null
            )}
          </View>
        </>
      )}
    </Card>
  );
}

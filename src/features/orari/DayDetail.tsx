import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { Card, SectionTitle } from '@/components/Card';
import { allGreenWindows } from '@/lib/domain/green-window';
import { hourlyBands } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Forecast, Weekday } from '@/schemas';

/** Hour-by-hour detail of the selected day, plus its free windows. Plain text, so it reads well with a screen reader. */
export function DayDetail({ day, forecast }: { day: Weekday; forecast: Forecast }) {
  const { t, weekday, band: bandLabel } = useI18n();
  const theme = useTheme();
  const bands = hourlyBands(forecast.buckets);
  const windows = allGreenWindows(forecast.buckets);
  const openHours = bands.map((band, hour) => ({ band, hour })).filter((h) => h.band !== null);
  const green = theme.band.green;

  return (
    <Card style={{ gap: 14 }}>
      <SectionTitle>{t('schedule.detail', { day: weekday(day) })}</SectionTitle>

      {openHours.length === 0 ? (
        <AppText muted style={{ fontSize: 14 }}>
          {t('schedule.closedDay')}
        </AppText>
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('schedule.freeWindows')}</AppText>
            {windows.length === 0 ? (
              <AppText muted style={{ fontSize: 13 }}>
                {t('schedule.noFreeWindows')}
              </AppText>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {windows.map((w) => (
                  <View key={w.from} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: green.soft }}>
                    <AppText color={green.onSoft} style={{ fontSize: 13, lineHeight: 17, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                      {w.from}–{w.to === '24:00' ? t('time.closing') : w.to}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('schedule.hourly')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 }}>
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
                      flexBasis: '45%',
                      flexGrow: 1,
                      minHeight: 36,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}>
                    <AppText muted style={{ fontFamily: fontFamily.mono, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                      {String(hour).padStart(2, '0')}:00
                    </AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <BandIcon band={band} size={10} color={theme.band[band].solid} />
                      <AppText color={theme.band[band].solid} style={{ fontSize: 12, fontWeight: '600' }}>
                        {bandLabel(band)}
                      </AppText>
                    </View>
                  </View>
                ) : null
              )}
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

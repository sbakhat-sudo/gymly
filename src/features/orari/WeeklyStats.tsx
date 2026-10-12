import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { bandRanges, widestRange, type HourRange } from '@/lib/domain/weekly-stats';
import { useI18n } from '@/lib/i18n';
import type { WeeklyStat } from '@/lib/real-schedule';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band, Weekday } from '@/schemas';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];
const BANDS = ['green', 'amber', 'red'] as const satisfies readonly Band[];

function formatRange(r: HourRange): string {
  const pad = (h: number) => String(h % 24).padStart(2, '0');
  return `${pad(r.from)}–${pad(r.to)}`;
}

/**
 * "Statistiche della settimana" (Aurora): per weekday, the widest real window seen at each band
 * across the last several weeks of check-ins — the pattern, not a prediction for any one date.
 * A weekday with zero samples says so instead of showing an empty-looking row.
 */
export function WeeklyStats({ stats }: { stats: readonly WeeklyStat[] }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ borderRadius: radius.card, padding: 18, gap: spacing.md, backgroundColor: theme.surface }}>
      <View style={{ gap: 2 }}>
        <AppText variant="title">{t('schedule.stats.title')}</AppText>
        <AppText muted style={{ fontSize: 12 }}>
          {t('schedule.stats.subtitle')}
        </AppText>
      </View>

      {stats.length === 0 ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('schedule.stats.empty')}
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {DAYS.map((day) => (
            <DayRow key={day} day={day} stats={stats.filter((s) => s.weekday === day && s.samples > 0)} />
          ))}
        </View>
      )}
    </View>
  );
}

function DayRow({ day, stats }: { day: Weekday; stats: readonly WeeklyStat[] }) {
  const { t, weekday, band: bandLabel } = useI18n();
  const theme = useTheme();

  const ranges = bandRanges(stats.map((s) => ({ hour: s.hour, band: s.band })));
  const tags = BANDS.map((band) => ({ band, range: widestRange(ranges[band]) })).filter((t) => t.range !== null);

  return (
    <View style={{ gap: 6, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <AppText style={{ fontSize: 13, fontWeight: '700' }}>{weekday(day)}</AppText>
      {tags.length === 0 ? (
        <AppText muted style={{ fontSize: 12 }}>
          {t('schedule.stats.insufficientDay')}
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(({ band, range }) => {
            const colors = theme.band[band];
            return (
              <View
                key={band}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: radius.pill,
                  backgroundColor: colors.soft,
                }}>
                <View {...decorativeA11yProps}>
                  <BandIcon band={band} size={9} color={colors.solid} />
                </View>
                <AppText color={colors.onSoft} style={{ fontSize: 11, fontWeight: '700' }}>
                  {bandLabel(band)} {range ? formatRange(range) : ''}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

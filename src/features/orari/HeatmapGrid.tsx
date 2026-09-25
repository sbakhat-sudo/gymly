import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { hourlyBands } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';
import type { Band, Forecast, Weekday } from '@/schemas';

const CELL_H = 30;
const HOUR_COL_W = 30;

interface HeatmapGridProps {
  week: readonly Forecast[];
  firstHour: number;
  lastHour: number;
  selectedDay: Weekday;
  onSelectDay: (day: Weekday) => void;
  /** Cell of the current moment, highlighted with a solid outline. */
  now: { weekday: Weekday; hour: number } | null;
  /** The member's habitual arrival, marked with a star. */
  habit: { weekday: Weekday; hour: number } | null;
}

/**
 * Weekly grid: 7 day columns × hourly rows. Each cell shows the forecast band by colour AND by
 * shape (circle / triangle / square, as in the Home hero); closed hours are dashed and empty.
 * A whole column is one large touch target (tap = day detail), so the 44pt minimum holds even
 * though the columns are narrow. The day detail list carries the accessible per-hour text.
 */
export function HeatmapGrid({ week, firstHour, lastHour, selectedDay, onSelectDay, now, habit }: HeatmapGridProps) {
  const theme = useTheme();
  const { weekday, weekdayShort, t } = useI18n();
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const perDay = week.map((day) => hourlyBands(day.buckets));

  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      <View style={{ width: HOUR_COL_W }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ height: 44 }} />
        {hours.map((h) => (
          <View key={h} style={{ height: CELL_H + 4, justifyContent: 'center' }}>
            <AppText variant="caption" muted>
              {String(h).padStart(2, '0')}
            </AppText>
          </View>
        ))}
      </View>

      {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => {
        const selected = day === selectedDay;
        const bands = perDay[day] ?? [];
        return (
          <Pressable
            key={day}
            onPress={() => onSelectDay(day)}
            accessibilityRole="button"
            accessibilityLabel={t('schedule.dayA11y', { day: weekday(day) })}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minWidth: 34,
              borderRadius: radius.md,
              backgroundColor: selected ? theme.surfaceAlt : 'transparent',
              paddingBottom: 2,
            }}>
            <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="caption" style={{ fontWeight: selected ? '800' : '600' }}>
                {weekdayShort(day)}
              </AppText>
            </View>
            {hours.map((h) => (
              <Cell
                key={h}
                band={bands[h] ?? null}
                isNow={now?.weekday === day && now.hour === h}
                isHabit={habit?.weekday === day && habit.hour === h}
              />
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

function Cell({ band, isNow, isHabit }: { band: Band | null; isNow: boolean; isHabit: boolean }) {
  const theme = useTheme();
  const colors = band ? theme.band[band] : null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: CELL_H,
        margin: 2,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors ? colors.solid : 'transparent',
        // Closed = dashed and empty; now = solid heavy outline in the text colour.
        borderWidth: isNow ? 3 : band ? 0 : 1,
        borderStyle: band || isNow ? 'solid' : 'dashed',
        borderColor: isNow ? theme.text : theme.border,
      }}>
      {band && colors ? (
        isHabit ? (
          <AppText color={colors.onSolid} style={{ fontSize: 14, fontWeight: '800', lineHeight: 16 }}>
            ★
          </AppText>
        ) : (
          <BandIcon band={band} size={13} color={colors.onSolid} />
        )
      ) : null}
    </View>
  );
}

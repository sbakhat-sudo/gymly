import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { hourlyBands } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { fontFamily, useTheme } from '@/lib/theme';
import type { Band, Forecast, Weekday } from '@/schemas';

const LABEL_W = 34;
const CELL_H = 24;
const GAP = 3;

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
 * Weekly grid: 7 day rows × hourly columns. Each cell shows the forecast band by colour AND by a
 * small shape (circle / triangle / square, as everywhere else); closed hours are dashed and empty.
 * A whole row is one touch target (tap = day detail): the row is 34pt tall and its vertical
 * hitSlop brings the target to the 44pt minimum. The day detail list carries the per-hour text.
 */
export function HeatmapGrid({ week, firstHour, lastHour, selectedDay, onSelectDay, now, habit }: HeatmapGridProps) {
  const theme = useTheme();
  const { weekday, weekdayShort, t } = useI18n();
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const perDay = week.map((day) => hourlyBands(day.buckets));

  return (
    <View style={{ gap: 2 }}>
      <View {...decorativeA11yProps} style={{ flexDirection: 'row', gap: GAP, marginBottom: 2 }}>
        <View style={{ width: LABEL_W }} />
        {hours.map((h) => (
          <View key={h} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
            <AppText
              color={theme.faint}
              numberOfLines={1}
              style={{ fontFamily: fontFamily.mono, fontSize: 9, lineHeight: 12, width: 24, textAlign: 'center' }}>
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
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
            hitSlop={{ top: 5, bottom: 5 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: GAP,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: selected ? theme.glassTint : 'transparent',
            }}>
            <AppText
              color={selected ? theme.text : theme.textMuted}
              style={{ width: LABEL_W, paddingLeft: 4, fontSize: 12, lineHeight: 16, fontWeight: selected ? '700' : '500' }}>
              {weekdayShort(day)}
            </AppText>
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
  const cell = (
    <View
      {...decorativeA11yProps}
      style={{
        flex: 1,
        alignSelf: 'stretch',
        borderRadius: isNow ? 3 : 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors ? colors.solid : 'transparent',
        // Closed = dashed and empty.
        borderWidth: band ? 0 : 1,
        borderStyle: 'dashed',
        borderColor: theme.border,
      }}>
      {band && colors ? (
        isHabit ? (
          <AppText color={colors.onSolid} style={{ fontSize: 10, lineHeight: 12, fontWeight: '700' }}>
            ★
          </AppText>
        ) : (
          <View style={{ opacity: 0.85 }}>
            <BandIcon band={band} size={8} color={colors.onSolid} />
          </View>
        )
      ) : null}
    </View>
  );
  // "Adesso": a double ring — 2px of page colour, then 2px of text colour — so it reads on any band fill.
  return (
    <View
      {...decorativeA11yProps}
      style={{
        flex: 1,
        height: CELL_H,
        flexDirection: 'row',
        borderRadius: 5,
        padding: isNow ? 2 : 0,
        borderWidth: isNow ? 2 : 0,
        borderColor: theme.text,
        backgroundColor: isNow ? theme.surface : 'transparent',
      }}>
      {cell}
    </View>
  );
}

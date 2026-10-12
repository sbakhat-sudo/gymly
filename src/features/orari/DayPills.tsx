import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Orb } from '@/components/Orb';
import { decorativeA11yProps } from '@/lib/a11y';
import { dominantBand } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';
import type { Forecast, Weekday } from '@/schemas';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];

interface DayPillsProps {
  week: readonly Forecast[];
  selectedDay: Weekday;
  onSelectDay: (day: Weekday) => void;
  today: Weekday;
}

/**
 * Week strip (Aurora): seven glass tiles with the day, a glowing spotlight and solid fill on the
 * selected one, an "Oggi" chip on today — each tile tinted by that day's typical band, so the
 * colour alone says "generally quiet" or "generally busy" without an hour-by-hour chart. Storico is
 * history only: today and any day after it are shown dimmed and cannot be opened, the same rule
 * `RealDayPills` applies to real data.
 */
export function DayPills({ week, selectedDay, onSelectDay, today }: DayPillsProps) {
  const { weekday, weekdayShort, t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {DAYS.map((day) => {
        const selected = day === selectedDay;
        const isToday = day === today;
        const notHistory = day >= today;
        // The day's own typical status (most common band across its open hours) is the only signal
        // on the tile now — kept separate from the "selected" state (which stays solid black/white)
        // so the two don't fight for the same pill. Not computed for today/future: there is no
        // "typical status" yet for a day Storico won't show.
        const band = notHistory ? null : dominantBand(week[day]?.buckets ?? []);
        const fg = selected ? theme.background : notHistory ? theme.textMuted : band ? theme.band[band].onSoft : theme.text;
        return (
          <Pressable
            key={day}
            onPress={() => !notHistory && onSelectDay(day)}
            disabled={notHistory}
            accessibilityRole="button"
            accessibilityLabel={
              notHistory
                ? t('schedule.future.dayA11y', { day: weekday(day) })
                : `${t('schedule.dayA11y', { day: weekday(day) })}${isToday ? `, ${t('schedule.today').toLowerCase()}` : ''}`
            }
            accessibilityState={{ selected, disabled: notHistory }}
            style={({ pressed }) => ({ flex: 1, opacity: notHistory ? 0.45 : pressed ? 0.85 : 1 })}>
            <View style={{ alignItems: 'center', minHeight: 18 }}>
              {isToday ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -7,
                    paddingVertical: 2,
                    paddingHorizontal: 7,
                    borderRadius: radius.pill,
                    backgroundColor: theme.primary,
                  }}>
                  <AppText
                    color={theme.onPrimary}
                    maxFontSizeMultiplier={1.2}
                    style={{ fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 8 * 0.08 }}>
                    {t('schedule.today').toUpperCase()}
                  </AppText>
                </View>
              ) : null}
            </View>

            <View style={{ overflow: 'visible' }}>
              {selected ? (
                <View {...decorativeA11yProps} style={{ position: 'absolute', top: -34, left: '50%', marginLeft: -55, width: 110, height: 110 }}>
                  <Orb color={theme.primary} size={110} />
                </View>
              ) : null}
              <View
                style={{
                  minHeight: 56,
                  borderRadius: radius.lg,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.text : notHistory ? theme.glass : band ? theme.band[band].soft : theme.glass,
                  borderWidth: 1,
                  borderColor: selected ? 'transparent' : theme.glassBorder,
                }}>
                <AppText color={fg} maxFontSizeMultiplier={1.3} style={{ fontSize: 15, lineHeight: 18, fontWeight: '800', letterSpacing: 15 * -0.02 }}>
                  {weekdayShort(day)}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

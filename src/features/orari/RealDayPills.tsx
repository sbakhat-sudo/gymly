import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Orb } from '@/components/Orb';
import { decorativeA11yProps } from '@/lib/a11y';
import { BAND_ORDER } from '@/lib/domain/band';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';
import type { Band, Weekday } from '@/schemas';

import type { RealHourBand } from '@/lib/real-schedule';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[];

/** The day's most common real band — same "at-a-glance day colour" idea as `dominantBand` in
 * `lib/domain/heatmap.ts`, just built from this screen's own `Map<hour, Band>` shape instead of
 * forecast buckets. */
function dominantRealBand(dateBands: Map<number, Band>): Band | null {
  const counts: Record<Band, number> = { green: 0, amber: 0, red: 0 };
  for (const band of dateBands.values()) counts[band] += 1;
  let best: Band | null = null;
  for (const band of BAND_ORDER) {
    if (counts[band] > 0 && (best === null || counts[band] > counts[best])) best = band;
  }
  return best;
}

interface RealDayPillsProps {
  dates: readonly string[];
  bands: readonly RealHourBand[];
  selectedDay: Weekday;
  onSelectDay: (day: Weekday) => void;
  today: Weekday;
}

/** Week strip, real data only: today and any day after it are shown dimmed and cannot be opened —
 * Storico only ever shows completed days, the app never pretends to know "today so far". Each
 * historical tile is tinted by that day's typical band. */
export function RealDayPills({ dates, bands, selectedDay, onSelectDay, today }: RealDayPillsProps) {
  const { weekday, weekdayShort, t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {DAYS.map((day) => {
        const selected = day === selectedDay;
        const isToday = day === today;
        const notHistory = day >= today;
        const dateKey = dates[day];
        const dateBands = new Map<number, Band>();
        if (dateKey) for (const b of bands) if (b.dateKey === dateKey) dateBands.set(b.hour, b.band);
        // Only genuinely past days have real bands to summarise — today/future stay muted.
        const band = notHistory ? null : dominantRealBand(dateBands);
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
                <View style={{ position: 'absolute', top: -7, paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: theme.primary }}>
                  <AppText color={theme.onPrimary} maxFontSizeMultiplier={1.2} style={{ fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 8 * 0.08 }}>
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

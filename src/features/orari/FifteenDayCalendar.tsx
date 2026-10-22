import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CalendarIcon } from '@/components/icons';
import { decorativeA11yProps } from '@/lib/a11y';
import { BAND_ORDER } from '@/lib/domain/band';
import { useI18n } from '@/lib/i18n';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

export interface CalendarDay {
  dateKey: string;
  /** A few real checkpoints through that day's opening hours, oldest first — empty for a day with
   * no real check-ins at all (shown as an empty column, never a fabricated dot). */
  checkpoints: { hour: number; band: Band }[];
}

const DOT = 30;

/**
 * "Calendario 15 Giorni": one column per real past day (oldest → newest, horizontally scrollable —
 * 15 columns never fit a phone width at once), each a short stack of real checkpoint hours through
 * that day, colour-coded by band. The circle shows the HOUR, never a person count — `checkpoints`
 * only ever carries real `get_week_real_bands` rows, so an empty column means no real data for that
 * day, not zero people.
 */
export function FifteenDayCalendar({ days }: { days: readonly CalendarDay[] }) {
  const { t, weekdayShort } = useI18n();
  const theme = useTheme();

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <CalendarIcon color={theme.primary} size={20} />
        <AppText accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800', flexShrink: 1 }}>
          {t('schedule.calendar15.title')}
        </AppText>
      </View>
      <AppText muted style={{ fontSize: 12, marginTop: -6 }}>
        {t('schedule.calendar15.subtitle')}
      </AppText>

      {days.length === 0 ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('schedule.calendar15.empty')}
        </AppText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: 2 }}>
          {days.map((day) => {
            const weekday = weekdayFromDateKey(day.dateKey);
            const dayNumber = Number(day.dateKey.slice(8, 10));
            return (
              <View key={day.dateKey} style={{ alignItems: 'center', gap: 6, width: DOT + 8 }}>
                <AppText variant="caption" muted numberOfLines={1} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                  {weekdayShort(weekday)}
                </AppText>
                <AppText numberOfLines={1} style={{ fontSize: 11, fontWeight: '700' }}>
                  {dayNumber}
                </AppText>
                <View style={{ gap: 6 }}>
                  {day.checkpoints.length === 0 ? (
                    <View
                      {...decorativeA11yProps}
                      style={{ width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border }}
                    />
                  ) : (
                    day.checkpoints.map((c) => (
                      <View
                        key={c.hour}
                        {...decorativeA11yProps}
                        style={{ width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.band[c.band].solid }}>
                        <AppText color={theme.band[c.band].onSolid} style={{ fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                          {c.hour}
                        </AppText>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingTop: 2 }}>
        {BAND_ORDER.map((band) => (
          <LegendDot key={band} band={band} />
        ))}
      </View>
    </View>
  );
}

function LegendDot({ band }: { band: Band }) {
  const { band: bandLabel } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View {...decorativeA11yProps} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.band[band].solid }} />
      <AppText variant="caption" muted style={{ fontSize: 11 }}>
        {bandLabel(band)}
      </AppText>
    </View>
  );
}

/** `YYYY-MM-DD` → 0=Monday..6=Sunday, by plain calendar math (no timezone conversion needed — the
 * date key is already the gym's own local calendar day). */
function weekdayFromDateKey(dateKey: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ((jsDay + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

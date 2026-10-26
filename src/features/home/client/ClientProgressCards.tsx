import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CalendarIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { monthCalendar } from '@/lib/domain/client-home';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Weekday } from '@/schemas';

/** The current month as a calendar: a filled circle on every day the member went, today ringed, the future dimmed. */
export function MonthCalendarCard({ todayKey, days }: { todayKey: string; days: ReadonlySet<string> }) {
  const { t, lang, weekdayShort } = useI18n();
  const theme = useTheme();
  const cal = monthCalendar(todayKey, days);
  const visitedCount = cal.days.filter((d) => d.visited).length;
  const monthName = new Date(`${todayKey}T12:00:00`).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'long' });
  const cells: (typeof cal.days[number] | null)[] = [...Array<null>(cal.leading).fill(null), ...cal.days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <CalendarIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('home.client.month.label')}
          </AppText>
          <AppText style={{ fontWeight: '800', fontSize: 18 }}>
            {monthName.charAt(0).toUpperCase() + monthName.slice(1)} · {t(visitedCount === 1 ? 'home.client.month.one' : 'home.client.month.other', { n: visitedCount })}
          </AppText>
        </View>
      </View>

      <View style={{ gap: 6 }} accessible accessibilityLabel={t('home.client.month.a11y', { n: visitedCount })}>
        <View style={{ flexDirection: 'row' }}>
          {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => (
            <View key={w} style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="caption" muted style={{ fontWeight: '700' }}>
                {weekdayShort(w).charAt(0).toUpperCase()}
              </AppText>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {row.map((c, ci) => (
              <View key={ci} style={{ flex: 1, alignItems: 'center' }}>
                {c ? (
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: c.visited ? theme.primary : 'transparent',
                      borderWidth: c.isToday ? 2 : 0,
                      borderColor: c.isToday ? theme.primary : 'transparent',
                    }}>
                    <AppText style={{ fontSize: 13, fontWeight: c.visited || c.isToday ? '800' : '500', color: c.visited ? theme.onPrimary : c.isFuture ? theme.faint : theme.text }}>{c.day}</AppText>
                  </View>
                ) : (
                  <View style={{ width: 34, height: 34 }} />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

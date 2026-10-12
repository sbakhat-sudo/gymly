import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { decorativeA11yProps } from '@/lib/a11y';
import { parseTime } from '@/lib/domain/time';
import { useI18n } from '@/lib/i18n';
import { fontFamily, spacing, useTheme } from '@/lib/theme';
import type { Weekday } from '@/schemas';

interface FreeWindow {
  from: string;
  to: string;
}

interface FreeWindowsListProps {
  day: Weekday;
  windows: readonly FreeWindow[];
}

/** `06:00`–`08:00` → 2 (whole + fractional hours); handles the `24:00` closing-time sentinel. */
function durationMinutes(from: string, to: string): number {
  return parseTime(to) - parseTime(from);
}

/** A past day's free windows, Storico: plain rows (time range + how long) — no reminder button,
 * since every window shown here has already happened. */
export function FreeWindowsList({ day, windows }: FreeWindowsListProps) {
  const { t, weekday } = useI18n();
  const theme = useTheme();
  const green = theme.band.green;

  return (
    <View style={{ borderRadius: 30, padding: 18, backgroundColor: theme.surface }}>
      <AppText accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase', marginBottom: spacing.sm }} color={theme.textMuted}>
        {t('schedule.freeWindows.heading', { day: weekday(day) })}
      </AppText>

      {windows.length === 0 ? (
        <AppText muted style={{ fontSize: 14, paddingVertical: 10 }}>
          {t('schedule.noFreeWindows')}
        </AppText>
      ) : (
        <View>
          {windows.map((w) => {
            const minutes = durationMinutes(w.from, w.to);
            const hours = minutes / 60;
            const durationLabel =
              hours >= 1
                ? t(`schedule.window.duration.${hours === 1 ? 'one' : 'other'}`, { n: Math.round(hours * 10) / 10 })
                : t('schedule.window.duration.minutes', { n: minutes });
            return (
              <View
                key={w.from}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, borderTopWidth: 1, borderTopColor: theme.glassBorder }}>
                <View {...decorativeA11yProps} style={{ width: 5, height: 30, borderRadius: 3, backgroundColor: green.solid }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: fontFamily.mono, fontSize: 17, lineHeight: 22, letterSpacing: 17 * -0.02, fontVariant: ['tabular-nums'] }}>
                    {w.from}–{w.to === '24:00' ? t('time.closing') : w.to}
                  </AppText>
                  <AppText muted style={{ fontSize: 12 }}>
                    {durationLabel}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ClockIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { todayOpening, windowsOf } from '@/lib/domain/client-home';
import { localTime } from '@/lib/domain/time';
import type { SiteStatus } from '@/lib/gym-status';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Weekday } from '@/schemas';

const WEEK: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function clock(minutes: number): string {
  const m = Math.min(1440, minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * "Apertura e chiusura": is the gym open right now, when does it close or open next, and the whole week's
 * hours — each day with a small timeline scaled to THIS gym's own earliest opening and latest closing, so a
 * gym open 06:00–23:00 and one open 15:00–21:00 both fill the bar. Today is highlighted. The Manager's manual
 * "chiuso" switch is honoured: a gym closed by hand says so, whatever the schedule.
 */
export function GymHoursCard({ site, nowMs }: { site: Pick<SiteStatus, 'timezone' | 'openingHours' | 'manuallyOpen'>; nowMs: number }) {
  const { t, weekday: weekdayName } = useI18n();
  const theme = useTheme();
  const local = localTime(new Date(nowMs), site.timezone);
  const today = todayOpening(site.openingHours, local.weekday, local.minutes);
  const isOpen = today.kind === 'open' && site.manuallyOpen;
  const closedByHand = today.kind === 'open' && !site.manuallyOpen;

  // The span every day's bar is drawn against.
  let from = 1440;
  let to = 0;
  for (const wd of WEEK) {
    for (const w of windowsOf(site.openingHours, wd)) {
      from = Math.min(from, w.start);
      to = Math.max(to, w.end);
    }
  }
  const span = Math.max(60, to - from);
  const hasHours = to > 0;

  const fmtLeft = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? t('home.client.hours.hm', { h, m }) : t('home.client.hours.h', { h })) : t('home.client.hours.m', { m });
  };

  const headline = !hasHours
    ? t('home.client.hours.noSchedule')
    : closedByHand
      ? t('home.client.hours.closedByHand')
      : today.kind === 'open'
        ? t('home.client.hours.closesAt', { time: clock(today.closesAt) })
        : today.kind === 'opensLater'
          ? t('home.client.hours.opensAt', { time: clock(today.opensAt) })
          : today.next
            ? t('home.client.hours.reopens', { day: weekdayName(today.next.weekday), time: clock(today.next.opensAt) })
            : t('home.client.hours.noSchedule');
  const detail = closedByHand || !hasHours ? null : today.kind === 'open' ? t('home.client.hours.inLeft', { left: fmtLeft(today.minutesLeft) }) : today.kind === 'opensLater' ? t('home.client.hours.inLeft', { left: fmtLeft(today.minutesUntil) }) : null;

  const dot = isOpen ? theme.band.green.solid : theme.band.red.solid;
  const pillBg = isOpen ? theme.band.green.soft : theme.band.red.soft;
  const pillFg = isOpen ? theme.band.green.onSoft : theme.band.red.onSoft;

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <ClockIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('home.client.hours.label')}
          </AppText>
          <AppText style={{ fontWeight: '800', fontSize: 17, lineHeight: 22 }}>{headline}</AppText>
          {detail ? (
            <AppText muted style={{ fontSize: 13 }}>
              {detail}
            </AppText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: pillBg }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
          <AppText style={{ color: pillFg, fontWeight: '800', fontSize: 12.5 }}>{t(isOpen ? 'home.client.hours.open' : 'home.client.hours.closed')}</AppText>
        </View>
      </View>

      {hasHours ? (
        <View style={{ gap: 4 }}>
          {WEEK.map((wd) => {
            const windows = windowsOf(site.openingHours, wd);
            const isToday = wd === local.weekday;
            return (
              <View
                key={wd}
                accessible
                accessibilityLabel={`${weekdayName(wd)}: ${windows.length === 0 ? t('home.client.hours.closedDay') : windows.map((w) => `${clock(w.start)} – ${clock(w.end)}`).join(', ')}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: isToday ? theme.primary + '14' : 'transparent' }}>
                <AppText style={{ width: 92, fontSize: 13.5, fontWeight: isToday ? '800' : '600', color: isToday ? theme.primary : theme.text }} numberOfLines={1}>
                  {weekdayName(wd)}
                </AppText>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt }}>
                  {windows.map((w, i) => (
                    <View
                      key={i}
                      style={{ position: 'absolute', top: 0, bottom: 0, left: `${((w.start - from) / span) * 100}%`, width: `${((w.end - w.start) / span) * 100}%`, borderRadius: 4, backgroundColor: isToday ? theme.primary : theme.textMuted }}
                    />
                  ))}
                </View>
                <AppText style={{ width: 104, textAlign: 'right', fontSize: 12.5, fontWeight: isToday ? '800' : '500', color: windows.length === 0 ? theme.textMuted : theme.text }} numberOfLines={2}>
                  {windows.length === 0 ? t('home.client.hours.closedDay') : windows.map((w) => `${clock(w.start)}–${clock(w.end)}`).join('\n')}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

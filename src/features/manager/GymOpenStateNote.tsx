import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon, ClockIcon, MoonIcon } from '@/components/icons';
import { todayOpening } from '@/lib/domain/client-home';
import { formatTime, localTime } from '@/lib/domain/time';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import type { SiteStatus } from './manager-api';

/** "3 h 10 min", "45 min" — how long until the gym closes. */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ''}` : `${m} min`;
}

/**
 * What the open/closed switch actually means right now, under the switch: "Aperta ora · chiude alle 20:00",
 * "Chiusa da te" or "Fuori orario · riapre domani alle 07:00" — a small soft card with an icon, a title and one
 * line saying what it means for check-in. Replaces the old grey information banner.
 */
export function GymOpenStateNote({ status }: { status: Pick<SiteStatus, 'manuallyOpen' | 'openingHours' | 'timezone'> }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const now = useNow(30_000, true);
  const local = localTime(new Date(now), status.timezone);
  const opening = todayOpening(status.openingHours, local.weekday, local.minutes);

  let tone: 'green' | 'amber' | 'neutral';
  let title: string;
  let detail: string;
  let Icon = CheckIcon;

  if (!status.manuallyOpen) {
    tone = 'neutral';
    Icon = MoonIcon;
    title = t('manager.gym.state.closedByYou');
    detail = t('manager.gym.state.closedByYou.detail');
  } else if (opening.kind === 'open') {
    tone = 'green';
    title = t('manager.gym.state.open');
    detail = t('manager.gym.state.open.detail', { time: formatTime(opening.closesAt), left: duration(opening.minutesLeft) });
  } else {
    tone = 'amber';
    Icon = ClockIcon;
    title = t('manager.gym.state.outside');
    if (opening.kind === 'opensLater') {
      detail = t('manager.gym.state.outside.today', { time: formatTime(opening.opensAt) });
    } else if (opening.next) {
      const tomorrow = opening.next.weekday === (local.weekday + 1) % 7;
      detail = tomorrow
        ? t('manager.gym.state.outside.tomorrow', { time: formatTime(opening.next.opensAt) })
        : t('manager.gym.state.outside.on', {
            day: new Date(2024, 0, 1 + opening.next.weekday).toLocaleDateString(lang, { weekday: 'long' }),
            time: formatTime(opening.next.opensAt),
          });
    } else {
      detail = t('manager.gym.state.outside.none');
    }
  }

  const bg = tone === 'green' ? theme.band.green.soft : tone === 'amber' ? theme.band.amber.soft : theme.surfaceAlt;
  const fg = tone === 'green' ? theme.band.green.onSoft : tone === 'amber' ? theme.band.amber.onSoft : theme.text;
  const accent = tone === 'green' ? theme.band.green.solid : tone === 'amber' ? theme.band.amber.solid : theme.textMuted;

  return (
    <View accessible accessibilityRole="summary" accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${detail}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: bg }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
        <Icon color={accent} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color={fg} style={{ fontWeight: '800', fontSize: 15 }}>
          {title}
        </AppText>
        <AppText color={fg} style={{ fontSize: 13, lineHeight: 18, opacity: 0.85 }}>
          {detail}
        </AppText>
      </View>
    </View>
  );
}

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ChevronDownIcon, ClockIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { allGreenWindows, nextGreenWindow } from '@/lib/domain/green-window';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { ForecastBucket } from '@/schemas';

/** A free window as clock times (`to` exclusive; `24:00` = closing). */
export interface TimeWindow {
  from: string;
  to: string;
}

/**
 * The selected day's best free window: today, the next one still ahead; any other day, the longest
 * one (earliest on a tie). null when the day has no free window at all.
 */
export function bestWindowFor(buckets: readonly ForecastBucket[], isToday: boolean, nowMinutes: number): TimeWindow | null {
  if (isToday) return nextGreenWindow(buckets, nowMinutes);
  const windows = allGreenWindows(buckets);
  let best: TimeWindow | null = null;
  let bestLen = -1;
  for (const w of windows) {
    const len = minutesOf(w.to) - minutesOf(w.from);
    if (len > bestLen) {
      best = w;
      bestLen = len;
    }
  }
  return best;
}

function minutesOf(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Page header (Aurora): "Orari" + a subtitle, and a chip with the gym that opens Impostazioni. */
export function ScheduleHeader({ gymName, subtitle }: { gymName: string; subtitle?: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  // "Gymly Demo · Centro" → "Centro": the chip only needs the distinguishing part.
  const short = gymName.split('· ')[1] ?? gymName;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: 4 }}>
      <View style={{ gap: 4, flexShrink: 1 }}>
        <PageTitle icon={ClockIcon} label={t('schedule.title')} circleSize={22} fontSize={26} />
        <AppText muted style={{ fontSize: 13, lineHeight: 17 }}>
          {(subtitle ?? t('schedule.subtitle')).replace(/\.$/, '')}
        </AppText>
      </View>
      <Pressable
        onPress={() => router.push('/impostazioni')}
        accessibilityRole="button"
        accessibilityLabel={`${gymName}. ${t('home.changeGym')}`}
        hitSlop={5}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 34,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          maxWidth: 170,
        }}>
        <AppText numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', flexShrink: 1 }}>
          {short}
        </AppText>
        <ChevronDownIcon color={theme.textMuted} size={11} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

/** Card shell: muted day name over a display title ("Affluenza prevista"/"Affluenza reale"), opening span on the right. */
export function DayChartCard({ dayName, span, title, children }: { dayName: string; span: string; title?: string; children: ReactNode }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ borderRadius: 30, paddingTop: 22, paddingHorizontal: 18, paddingBottom: 18, gap: 18, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <AppText muted style={{ fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
            {dayName}
          </AppText>
          <AppText
            accessibilityRole="header"
            style={{ fontFamily: fontFamily.display, fontSize: 22, lineHeight: 26, letterSpacing: 22 * -0.05 }}>
            {title ?? t('schedule.dayCard.title')}
          </AppText>
        </View>
        <AppText muted style={{ fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {span}
        </AppText>
      </View>
      {children}
    </View>
  );
}

/** "Per te" (Aurora): compact brand card at the end of Orari, with the personal suggestion. */
export function PerTeCard({ text }: { text: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ borderRadius: radius.card, paddingVertical: spacing.lg, paddingHorizontal: 18, backgroundColor: theme.primary, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 34,
          height: 34,
          minWidth: 34,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText color={theme.onPrimary} style={{ fontSize: 15, lineHeight: 18 }}>
          ★
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText
          color={theme.onPrimary}
          accessibilityRole="header"
          style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 11 * 0.08, textTransform: 'uppercase', opacity: 0.85 }}>
          {t('schedule.suggestion.title')}
        </AppText>
        <AppText color={theme.onPrimary} style={{ fontSize: 15, lineHeight: 21, fontWeight: '500' }}>
          {text}
        </AppText>
      </View>
    </View>
  );
}


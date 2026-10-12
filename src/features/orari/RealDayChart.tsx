import { useState } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { isBucketOpen } from '@/lib/domain/time';
import { useI18n, type Params, type TranslationKey } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band, OpeningHours, Weekday } from '@/schemas';

const BAR_MIN = 18;
/** No `rel`/load at hour granularity: a fixed step per band tier, a shape rather than a measurement. */
const TIER_HEIGHT: Record<Band, number> = { green: 44, amber: 86, red: 128 };

type HourState = { kind: 'closed' } | { kind: 'future' } | { kind: 'unknown' } | { kind: 'band'; band: Band };

function hourState(open: boolean, isFuture: boolean, band: Band | null): HourState {
  if (!open) return { kind: 'closed' };
  if (isFuture) return { kind: 'future' };
  if (!band) return { kind: 'unknown' };
  return { kind: 'band', band };
}

interface RealDayChartProps {
  day: Weekday;
  dateBands: ReadonlyMap<number, Band>;
  openingHours: readonly OpeningHours[];
  firstHour: number;
  lastHour: number;
  /** Hours after this (today only) haven't happened yet — null when viewing a day that's fully in the past. */
  nowHour: number | null;
}

/**
 * One bar per visible hour of ONE real calendar day. Four honest states, never a guess: closed
 * (dashed, empty), hasn't happened yet (hatched, today only), open but no check-in recorded yet
 * (a small neutral dot — genuinely unknown, not "quiet"), or a real band from actual check-ins.
 */
export function RealDayChart({ day, dateBands, openingHours, firstHour, lastHour, nowHour }: RealDayChartProps) {
  const theme = useTheme();
  const { t, band: bandLabel } = useI18n();
  const hours = Array.from({ length: Math.max(0, lastHour - firstHour + 1) }, (_, i) => firstHour + i);
  const states = hours.map((h) => hourState(isBucketOpen(openingHours, day, h * 4), nowHour !== null && h > nowHour, dateBands.get(h) ?? null));
  const firstKnown = hours.findIndex((_, i) => states[i]?.kind === 'band' || states[i]?.kind === 'unknown');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(firstKnown >= 0 ? firstKnown : null);

  const tooltip = selectedIdx !== null ? { hour: hours[selectedIdx], state: states[selectedIdx] } : null;

  return (
    <View style={{ gap: spacing.sm }}>
      {tooltip && tooltip.state ? (
        <View style={{ alignSelf: 'flex-end', borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.text }}>
          <AppText color={theme.background} style={{ fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {t('schedule.chart.tooltip', { time: `${String(tooltip.hour).padStart(2, '0')}:00`, band: tooltipLabel(tooltip.state, t, bandLabel) })}
          </AppText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: BAR_MIN + TIER_HEIGHT.red }}>
        {hours.map((h, i) => (
          <Bar
            key={h}
            hour={h}
            day={day}
            state={states[i] ?? { kind: 'closed' }}
            selected={i === selectedIdx}
            onPress={() => setSelectedIdx(i)}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 3 }}>
        {hours.map((h) => (
          <View key={h} style={{ flex: 1, alignItems: 'center' }}>
            <AppText
              {...decorativeA11yProps}
              color={h === nowHour ? theme.text : theme.textMuted}
              style={{ fontFamily: fontFamily.mono, fontSize: 10, lineHeight: 13, fontWeight: h === nowHour ? '700' : '400' }}>
              {h === nowHour ? t('schedule.chart.now') : h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function tooltipLabel(state: HourState, t: (k: TranslationKey, p?: Params) => string, bandLabel: (b: Band) => string): string {
  if (state.kind === 'band') return bandLabel(state.band);
  if (state.kind === 'closed') return t('schedule.legend.closed');
  if (state.kind === 'future') return t('schedule.future.short');
  return t('schedule.unknown.short');
}

function Bar({ hour, day, state, selected, onPress }: { hour: number; day: Weekday; state: HourState; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t, weekday, band: bandLabel } = useI18n();
  const time = `${String(hour).padStart(2, '0')}:00`;

  const solid = state.kind === 'band' ? theme.band[state.band].solid : null;
  const height = state.kind === 'band' ? TIER_HEIGHT[state.band] : state.kind === 'unknown' ? BAR_MIN + 6 : BAR_MIN;
  const glow: ViewStyle = solid && selected && Platform.OS === 'web' ? ({ boxShadow: `0 0 14px -2px ${solid}` } as ViewStyle) : {};

  const label =
    state.kind === 'band'
      ? t('schedule.cellA11y', { day: weekday(day), hour: time, band: bandLabel(state.band) })
      : state.kind === 'closed'
        ? t('schedule.cellClosedA11y', { day: weekday(day), hour: time })
        : state.kind === 'future'
          ? t('schedule.future.dayA11y', { day: `${weekday(day)} ${time}` })
          : t('schedule.unknown.cellA11y', { day: weekday(day), hour: time });

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={{ flex: 1, alignItems: 'center' }}>
      <View
        style={[
          {
            width: '100%',
            height,
            borderRadius: radius.sm,
            backgroundColor: solid ?? 'transparent',
            borderWidth: solid ? (selected ? 2 : 0) : 1,
            borderStyle: solid ? 'solid' : state.kind === 'unknown' ? 'solid' : 'dashed',
            borderColor: solid ? theme.text : state.kind === 'unknown' ? theme.faint : theme.borderStrong,
            opacity: state.kind === 'future' ? 0.4 : 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 4,
          },
          glow,
        ]}>
        {state.kind === 'band' ? <BandIcon band={state.band} size={7} color={theme.band[state.band].onSolid} /> : null}
        {state.kind === 'unknown' ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.faint }} /> : null}
      </View>
    </Pressable>
  );
}

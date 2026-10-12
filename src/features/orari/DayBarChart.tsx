import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { hourlyBands, hourlyLoad } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, useTheme } from '@/lib/theme';
import type { Band, Weekday, ForecastBucket } from '@/schemas';

/** Room above the bars for the floating readout of the selected hour. */
const TIP_SPACE = 48;
const CHART_HEIGHT = 170;
const GAP = 5;

interface DayBarChartProps {
  day: Weekday;
  buckets: readonly ForecastBucket[];
  firstHour: number;
  lastHour: number;
  /** Current hour, when the chart is showing today — highlights that bar and labels it "Ora". */
  nowHour: number | null;
  /** The member's habitual arrival hour on this day, marked with a ★ above its bar. */
  habitHour?: number | null;
  /** Hour selected when the chart first shows (e.g. the best moment); defaults to now / first open hour. */
  initialHour?: number | null;
}

/**
 * "Affluenza prevista" (Aurora): one rounded pill per visible hour — a faint full-height track, filled
 * up to the forecast load (never a people count) in the band's colour, with the band's shape at the
 * foot (never colour alone). Unselected bars are dimmed; tapping one shows its time and band in a
 * floating readout right above it.
 */
export function DayBarChart({ day, buckets, firstHour, lastHour, nowHour, habitHour = null, initialHour = null }: DayBarChartProps) {
  const theme = useTheme();
  const { t, band: bandLabel } = useI18n();
  const bands = hourlyBands(buckets);
  const load = hourlyLoad(buckets);
  const hours = Array.from({ length: Math.max(0, lastHour - firstHour + 1) }, (_, i) => firstHour + i);
  const firstOpenHour = hours.find((h) => bands[h] !== null) ?? null;
  const fallback = initialHour ?? (nowHour !== null && bands[nowHour] !== null ? nowHour : firstOpenHour);
  const [selectedHour, setSelectedHour] = useState<number | null>(fallback);
  const selected = selectedHour !== null && hours.includes(selectedHour) ? selectedHour : null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-end', height: CHART_HEIGHT, paddingTop: TIP_SPACE }}>
        {hours.map((h, i) => {
          const band = bands[h] ?? null;
          const isSel = h === selected;
          // Keep the readout inside the card at both edges.
          const align = i < 2 ? 'left' : i > hours.length - 3 ? 'right' : 'center';
          return (
            <Bar
              key={h}
              hour={h}
              day={day}
              band={band}
              load={load[h] ?? 0}
              selected={isSel}
              habit={h === habitHour}
              tipAlign={align}
              tipText={isSel ? `${String(h).padStart(2, '0')}:00${h === nowHour ? ` · ${t('schedule.chart.now').toLowerCase()}` : ''}` : null}
              tipLabel={band ? bandLabel(band) : t('schedule.legend.closed')}
              onPress={() => setSelectedHour(h)}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: GAP }} {...decorativeA11yProps}>
        {hours.map((h) => {
          const strong = h === nowHour || h === selected;
          return (
            <View key={h} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
              <AppText
                color={strong ? theme.text : theme.faint}
                style={{ fontFamily: fontFamily.mono, fontSize: 9, lineHeight: 12, width: 28, textAlign: 'center' }}>
                {h === nowHour ? t('schedule.chart.now') : h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Bar({
  hour,
  day,
  band,
  load,
  selected,
  habit,
  tipAlign,
  tipText,
  tipLabel,
  onPress,
}: {
  hour: number;
  day: Weekday;
  band: Band | null;
  load: number;
  selected: boolean;
  habit: boolean;
  tipAlign: 'left' | 'center' | 'right';
  tipText: string | null;
  tipLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t, weekday, band: bandLabel } = useI18n();
  const time = `${String(hour).padStart(2, '0')}:00`;
  const colors = band ? theme.band[band] : null;
  const fillPct = band ? Math.round(12 + load * 88) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={band ? t('schedule.cellA11y', { day: weekday(day), hour: time, band: bandLabel(band) }) : t('schedule.cellClosedA11y', { day: weekday(day), hour: time })}
      accessibilityState={{ selected }}
      hitSlop={{ left: GAP / 2, right: GAP / 2 }}
      style={{
        flex: 1,
        height: '100%',
        borderRadius: radius.pill,
        backgroundColor: band ? theme.glassTint : 'transparent',
        borderWidth: band ? 0 : 1,
        borderStyle: 'dashed',
        borderColor: theme.border,
        justifyContent: 'flex-end',
      }}>
      {colors ? (
        <View
          style={{
            width: '100%',
            height: `${fillPct}%`,
            borderRadius: radius.pill,
            backgroundColor: colors.solid,
            opacity: selected ? 1 : 0.55,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 5,
          }}>
          {band ? <BandIcon band={band} size={6} color={colors.onSolid} /> : null}
        </View>
      ) : null}

      {habit ? (
        <AppText {...decorativeA11yProps} style={{ position: 'absolute', top: -16, alignSelf: 'center', fontSize: 11, lineHeight: 14 }}>
          ★
        </AppText>
      ) : null}

      {tipText ? (
        <View
          {...decorativeA11yProps}
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: 10,
            ...(tipAlign === 'left' ? { left: 0 } : tipAlign === 'right' ? { right: 0 } : { alignSelf: 'center' }),
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: theme.text,
            alignItems: 'center',
            gap: 1,
            zIndex: 2,
            width: 112,
          }}>
          <AppText color={theme.background} numberOfLines={1} style={{ fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 14 }}>
            {tipText}
          </AppText>
          <AppText color={theme.background} numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: '700' }}>
            {tipLabel}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

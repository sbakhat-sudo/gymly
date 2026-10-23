import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { BarChartIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { summarizeDay } from '@/lib/domain/gym-advice';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { BandChip } from './BandChip';

export interface YesterdayHour {
  hour: number;
  pct: number;
  band: Band;
}

const W = 320;
const H = 176;
const LEFT = 28;
const TOP = 26;
const BOTTOM = 24;

/** The band's shape drawn in SVG, centred on (cx, cy) — circle = Libera, triangle = Moderata, square = Affollata. */
function BandShape({ band, cx, cy, r, fill }: { band: Band; cx: number; cy: number; r: number; fill: string }) {
  if (band === 'green') return <Circle cx={cx} cy={cy} r={r} fill={fill} />;
  if (band === 'amber') return <Path d={`M${cx} ${cy - r} L${cx + r} ${cy + r * 0.85} L${cx - r} ${cy + r * 0.85} Z`} fill={fill} />;
  return <Rect x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} rx={1.5} fill={fill} />;
}

function clock(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * "Com'è andata ieri": yesterday hour by hour — one column per open hour, as tall as the gym was full
 * (a real percentage, 0–100, this screen's one deliberate exception to "never a people count") and
 * coloured by the band that hour fell in, with the band's own shape on top of the column so the level never
 * depends on colour alone. Above it, the day in one word (mostly Libera / Moderata / Affollata) and its
 * fullest moment. An hour with no real data is left empty, never filled in.
 */
export function YesterdayBandsCard({ hours, range }: { hours: readonly YesterdayHour[]; range: { first: number; last: number } | null }) {
  const { t } = useI18n();
  const theme = useTheme();
  const summary = summarizeDay(hours);

  const slots = range ? range.last - range.first + 1 : 0;
  const plotW = W - LEFT - 6;
  const plotH = H - TOP - BOTTOM;
  const baseline = TOP + plotH;
  const slotW = slots > 0 ? plotW / slots : plotW;
  const barW = Math.min(20, slotW * 0.7);
  const byHour = new Map(hours.map((h) => [h.hour, h]));
  const labelEvery = slots > 14 ? 3 : 2;

  const a11y = summary
    ? `${t('schedule.yesterday.verdict', { band: t(`band.${summary.band}`).toLowerCase() })}. ${t('schedule.yesterday.peak', { time: clock(summary.peakHour), pct: Math.round(summary.peakPct) })}`
    : t('schedule.yesterday.empty');

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <BarChartIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText accessibilityRole="header" style={{ fontSize: 18, lineHeight: 23, fontWeight: '800' }}>
            {t('schedule.yesterday.title')}
          </AppText>
          {summary ? (
            <AppText muted style={{ fontSize: 12.5 }}>
              {t('schedule.yesterday.peak', { time: clock(summary.peakHour), pct: Math.round(summary.peakPct) })}
            </AppText>
          ) : null}
        </View>
        {summary ? <BandChip band={summary.band} /> : null}
      </View>

      {summary ? (
        <AppText style={{ fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{t('schedule.yesterday.verdict', { band: t(`band.${summary.band}`).toLowerCase() })}</AppText>
      ) : (
        <AppText muted style={{ fontSize: 13.5 }}>
          {t('schedule.yesterday.empty')}
        </AppText>
      )}

      {range ? (
        <View accessible accessibilityRole="image" accessibilityLabel={a11y}>
          <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H }}>
            {[0, 50, 100].map((v) => {
              const y = baseline - (v / 100) * plotH;
              return (
                <G key={v}>
                  <Line x1={LEFT} y1={y} x2={W - 6} y2={y} stroke={theme.border} strokeWidth={v === 0 ? 1.2 : 0.8} strokeDasharray={v === 0 ? undefined : '3 4'} />
                  <SvgText x={LEFT - 5} y={y + 3.5} fontSize={9.5} fontFamily={fontFamily.body} textAnchor="end" fill={theme.textMuted}>
                    {v}%
                  </SvgText>
                </G>
              );
            })}

            {Array.from({ length: slots }, (_, i) => {
              const hour = (range?.first ?? 0) + i;
              const cx = LEFT + i * slotW + slotW / 2;
              const point = byHour.get(hour);
              const h = point ? Math.max(3, (point.pct / 100) * plotH) : 0;
              return (
                <G key={hour}>
                  {point ? (
                    <>
                      <Rect x={cx - barW / 2} y={baseline - h} width={barW} height={h} rx={3} fill={theme.band[point.band].solid} />
                      <BandShape band={point.band} cx={cx} cy={baseline - h - 8} r={4.2} fill={theme.band[point.band].solid} />
                    </>
                  ) : null}
                  {i % labelEvery === 0 ? (
                    <SvgText x={cx} y={baseline + 15} fontSize={9.5} fontFamily={fontFamily.body} textAnchor="middle" fill={theme.textMuted}>
                      {hour}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {(['green', 'amber', 'red'] as const).map((b) => (
          <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <BandIcon band={b} size={13} color={theme.band[b].solid} />
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {t(`band.${b}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

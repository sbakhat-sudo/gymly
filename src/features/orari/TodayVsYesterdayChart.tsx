import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { TrendingUpIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

export interface HourlyPoint {
  hour: number;
  pct: number;
}

const CHART_W = 320;
const CHART_H = 140;
const CHART_PAD_X = 6;
const CHART_PAD_Y = 14;
const GRID_LINES = 3;

/** Catmull-Rom → cubic Bézier (tension 1/6): the same real points, drawn as a smooth curve instead
 * of sharp hour-to-hour segments — purely cosmetic, the underlying data is untouched. */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  if (rest.length === 0) return `M${first.x},${first.y}`;
  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * "Oggi vs Ieri": today's real hourly occupancy percentage against yesterday's, same real
 * `get_week_real_bands` rows the rest of Storico uses — never a forecast. The Y axis is always a
 * percentage (this screen's one deliberate exception to "never a people count", see CLAUDE.md),
 * fixed 0–100 so the shape of the two days stays directly comparable. Only real past hours ever
 * appear: today's curve simply stops at the current hour, it is never extended with a guess.
 */
export function TodayVsYesterdayChart({ today, yesterday }: { today: readonly HourlyPoint[]; yesterday: readonly HourlyPoint[] }) {
  const { t } = useI18n();
  const theme = useTheme();

  // A single real point isn't a curve — need at least 2 to draw a line. Below that, this isn't
  // really a "today vs yesterday" comparison, just one real day's shape, and the title/badge/legend
  // say so instead of implying a comparison that isn't actually on screen.
  const hasToday = today.length > 1;
  const hasYesterday = yesterday.length > 1;
  const visibleHours = [...(hasToday ? today : []), ...(hasYesterday ? yesterday : [])].map((p) => p.hour);
  const minHour = visibleHours.length > 0 ? Math.min(...visibleHours) : 0;
  const maxHour = visibleHours.length > 0 ? Math.max(...visibleHours) : 1;
  const hourSpan = Math.max(1, maxHour - minHour);

  const toPoint = (p: HourlyPoint) => ({
    x: CHART_PAD_X + ((p.hour - minHour) / hourSpan) * (CHART_W - 2 * CHART_PAD_X),
    y: CHART_PAD_Y + (1 - p.pct / 100) * (CHART_H - 2 * CHART_PAD_Y),
  });

  const todayLast = hasToday ? today[today.length - 1] : undefined;
  const comparablePct = hasYesterday ? (yesterday.find((y) => y.hour === todayLast?.hour)?.pct ?? yesterday[yesterday.length - 1]?.pct) : undefined;
  const delta = hasToday && hasYesterday && todayLast && comparablePct !== undefined ? Math.round(todayLast.pct - comparablePct) : null;
  const trendUp = delta !== null && delta > 0;
  const trendDown = delta !== null && delta < 0;
  const trendColor = trendUp ? theme.band.green.solid : trendDown ? theme.danger : theme.textMuted;

  const titleKey = hasToday && hasYesterday ? 'schedule.todayVsYesterday.title' : hasToday ? 'schedule.todayVsYesterday.titleTodayOnly' : 'schedule.todayVsYesterday.titleYesterdayOnly';

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <TrendingUpIcon color={theme.primary} size={20} />
          <AppText accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>
            {t(titleKey)}
          </AppText>
        </View>
        {delta !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: `${trendColor}1F` }}>
            <View style={trendDown ? { transform: [{ rotate: '180deg' }] } : undefined}>
              <TrendingUpIcon color={trendColor} size={12} />
            </View>
            <AppText color={trendColor} numberOfLines={1} style={{ fontSize: 11, fontWeight: '800' }}>
              {t(trendUp ? 'schedule.todayVsYesterday.badgeUp' : trendDown ? 'schedule.todayVsYesterday.badgeDown' : 'schedule.todayVsYesterday.badgeFlat', { pct: Math.abs(delta) })}
            </AppText>
          </View>
        ) : null}
      </View>

      {!hasToday && !hasYesterday ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('schedule.todayVsYesterday.empty')}
        </AppText>
      ) : (
        <>
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="todayFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={theme.primary} stopOpacity={0.28} />
                <Stop offset="100%" stopColor={theme.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {Array.from({ length: GRID_LINES }, (_, i) => CHART_PAD_Y + (i / (GRID_LINES - 1)) * (CHART_H - 2 * CHART_PAD_Y)).map((y, i) => (
              <Line key={i} x1={0} y1={y} x2={CHART_W} y2={y} stroke={theme.glassBorder} strokeWidth={1} />
            ))}

            {hasToday ? (
              <Path
                d={`${smoothPath(today.map(toPoint))} L${toPoint(today[today.length - 1]!).x},${CHART_H} L${toPoint(today[0]!).x},${CHART_H} Z`}
                fill="url(#todayFill)"
                stroke="none"
              />
            ) : null}
            {hasYesterday ? (
              <Path d={smoothPath(yesterday.map(toPoint))} fill="none" stroke={theme.textMuted} strokeWidth={2} strokeDasharray="5,5" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {hasToday ? <Path d={smoothPath(today.map(toPoint))} fill="none" stroke={theme.primary} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" /> : null}

            {hasYesterday ? (
              <Circle cx={toPoint(yesterday[yesterday.length - 1]!).x} cy={toPoint(yesterday[yesterday.length - 1]!).y} r={3.5} fill={theme.surface} stroke={theme.textMuted} strokeWidth={2} />
            ) : null}
            {hasToday ? <Circle cx={toPoint(today[today.length - 1]!).x} cy={toPoint(today[today.length - 1]!).y} r={4.5} fill={theme.primary} stroke={theme.surface} strokeWidth={2.5} /> : null}
          </Svg>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" muted style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}>
              {String(minHour).padStart(2, '0')}:00
            </AppText>
            <AppText variant="caption" muted style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}>
              {String(maxHour).padStart(2, '0')}:00
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {hasToday ? <LegendLine color={theme.primary} dashed={false} label={t('schedule.todayVsYesterday.legendToday')} /> : null}
            {hasYesterday ? <LegendLine color={theme.textMuted} dashed label={t('schedule.todayVsYesterday.legendYesterday')} /> : null}
          </View>

          {delta !== null ? (
            <AppText muted style={{ fontSize: 12.5, lineHeight: 17, fontFamily: fontFamily.body }}>
              {t(trendUp ? 'schedule.todayVsYesterday.trendUp' : trendDown ? 'schedule.todayVsYesterday.trendDown' : 'schedule.todayVsYesterday.trendFlat')}
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}

function LegendLine({ color, dashed, label }: { color: string; dashed: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Svg width={16} height={4}>
        <Path d="M0,2 H16" stroke={color} strokeWidth={2.5} strokeDasharray={dashed ? '4,3' : undefined} />
      </Svg>
      <AppText variant="caption" muted style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

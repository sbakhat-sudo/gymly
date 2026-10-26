import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { ChevronRightIcon, CreditCardIcon, DumbbellIcon, PulseIcon, UsersIcon, XIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getOwnerOverview, getOwnerPlanBilling, getOwnerSubscriptionTrend, getOwnerSubscriptionWeeks, type OwnerSubscriptionRow, type OwnerSubscriptionTrendPoint, type OwnerSubscriptionWeekPoint } from './owner-api';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/** Small colour-tinted icon badge — same visual convention as Admin's KPI/chart cards. */
function IconBadge({ icon: Icon, tint, size = 34 }: { icon: IconType; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={tint} size={Math.round(size * 0.54)} />
    </View>
  );
}

/** Same animated tile as Admin's KpiCard (AdminDashboardScreen.tsx) — kept local here since it has
 * no onPress drill-down target yet (Owner has no per-KPI detail screen the way Admin's do). */
function KpiCard({ index, icon, tint, label, value, onPress }: { index: number; icon: IconType; tint: string; label: string; value: string; onPress?: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 420, delay: index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, progress, index]);

  const opacity = progress;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const glow: ViewStyle = Platform.OS === 'web' ? ({ boxShadow: '0 8px 24px -12px rgba(0,0,0,0.25)' } as ViewStyle) : {};

  const card = (
      <View
        style={[
          {
            borderRadius: radius.card,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            gap: 8,
            backgroundColor: theme.glass,
            borderWidth: 1,
            borderColor: theme.glassBorder,
          },
          glow,
        ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconBadge icon={icon} tint={tint} />
          <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </AppText>
          {onPress ? <ChevronRightIcon color={theme.textMuted} size={16} /> : null}
        </View>
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, color: theme.text }}>{value}</AppText>
      </View>
  );

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flexBasis: '47%', flexGrow: 1 }}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. ${t('owner.dashboard.subscriptions.details')}`} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          {card}
        </Pressable>
      ) : (
        card
      )}
    </Animated.View>
  );
}

/** The list itself: one row per subscription the Owner offers (plus any a Manager made that someone pays for) —
 * its name, monthly or annual, how many people are on it and what they pay. With none at all, an empty state
 * instead of a grid of zeros. Numbers and words only, the colour dot is a decoration. */
function SubscriptionGrid({ rows }: { rows: OwnerSubscriptionRow[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const money = (n: number): string => `€${n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}`;
  const kindLabel = (kind: 'monthly' | 'annual'): string => t(kind === 'monthly' ? 'owner.dashboard.subscriptions.monthly' : 'owner.dashboard.subscriptions.annual');

  if (rows.length === 0) return <EmptyState message={t('owner.dashboard.subscriptions.empty')} icon={CreditCardIcon} />;

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r, i) => (
        <View
          key={r.planKey}
          accessible
          accessibilityLabel={`${r.name}, ${kindLabel(r.kind)}: ${t('owner.dashboard.subscriptions.people', { count: r.count })}, ${money(r.revenueEur)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.glassBorder }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: r.color ?? theme.primary }} />
          <View style={{ flex: 1 }}>
            <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
              {r.name}
            </AppText>
            <AppText variant="caption" muted>
              {kindLabel(r.kind)}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText style={{ fontFamily: fontFamily.displaySemi, fontSize: 20, lineHeight: 24 }}>{r.count}</AppText>
            <AppText variant="caption" muted>
              {money(r.revenueEur)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** What opens when the Owner taps "Fatturato": the total, then who is on which subscription. */
function SubscriptionDetailsModal({ visible, rows, total, onClose }: { visible: boolean; rows: OwnerSubscriptionRow[]; total: string; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: '92%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <AppText variant="display" numberOfLines={1} style={{ fontSize: 20 }}>
                {t('owner.dashboard.subscriptions.title')}
              </AppText>
              <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
                {t('owner.dashboard.subscriptions.hint')}
              </AppText>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <XIcon color={theme.text} size={20} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {t('owner.dashboard.revenue')}
              </AppText>
              <AppText style={{ fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36 }}>{total}</AppText>
            </View>

            <SubscriptionGrid rows={rows} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// A plan without a colour of its own (an old Manager plan) takes one of these in order — the legend and the
// numbers on the bars carry the meaning too, never the colour alone.
const TREND_FALLBACK_COLORS = ['#8B5CF6', '#EAB308', '#F97316', '#3B82F6', '#EF4444', '#22C55E', '#EC4899', '#14B8A6'];

const TREND_W = 720;
const TREND_H = 300;
const TREND_TOP = 30;
const TREND_BOTTOM = 56;
const TREND_LEFT = 34;

interface TrendBar {
  key: string;
  label: string;
  sub: string;
  /** Subscriptions paid or renewed, per plan key. */
  values: Record<string, number>;
}

interface TrendSeries {
  key: string;
  name: string;
  kind: 'monthly' | 'annual';
  color: string;
}

/** Subscriptions paid or renewed, stacked: one column per week (this month) or per month, each split into one
 * coloured segment per plan the clients chose (the Owner's own plans, plus any a Manager made that someone paid
 * for), the count written inside every segment and the column's total above it. Hand-rolled SVG like the other
 * charts in this app. */
function SubscriptionTrendCard({ months, weeks }: { months: OwnerSubscriptionTrendPoint[]; weeks: OwnerSubscriptionWeekPoint[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  // Two views: the monthly subscriptions week by week through this month, and the annual ones month by month
  // (an annual plan is only paid once a year, so weeks would be empty).
  const [view, setView] = useState<'monthly' | 'annual'>('monthly');
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';
  const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');

  // One series per plan, in the order the database lists them (oldest plan first). A plan keeps its colour
  // whichever view is open; each view shows only the plans of its own kind.
  const allSeries: TrendSeries[] = [];
  for (const p of [...months, ...weeks]) {
    if (allSeries.some((s) => s.key === p.planKey)) continue;
    allSeries.push({ key: p.planKey, name: p.planName, kind: p.kind, color: p.planColor ?? TREND_FALLBACK_COLORS[allSeries.length % TREND_FALLBACK_COLORS.length] ?? '#8B5CF6' });
  }
  const series = allSeries.filter((s) => s.kind === view);

  const dayMonth = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00`);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const bars: TrendBar[] =
    view === 'monthly'
      ? Array.from(new Set(weeks.map((w) => w.weekNo))).map((n) => {
          const rows = weeks.filter((w) => w.weekNo === n);
          const first = rows[0];
          const start = first ? dayMonth(first.rangeStart) : '';
          const end = first ? dayMonth(first.rangeEnd) : '';
          return {
            key: `w${n}`,
            label: t('owner.dashboard.trend.week', { n }),
            sub: start === end ? start : `${start}–${end}`,
            values: Object.fromEntries(rows.map((r) => [r.planKey, r.subscribers])),
          };
        })
      : Array.from(new Set(months.map((m) => m.monthStart))).map((m) => ({
          key: m,
          label: capitalize(new Date(`${m}T00:00:00`).toLocaleDateString(locale, { month: 'short' })),
          sub: String(new Date(`${m}T00:00:00`).getFullYear()),
          values: Object.fromEntries(months.filter((r) => r.monthStart === m).map((r) => [r.planKey, r.subscribers])),
        }));

  const totalOf = (b: TrendBar): number => series.reduce((sum, s) => sum + (b.values[s.key] ?? 0), 0);
  const max = Math.max(1, ...bars.map(totalOf));
  const grandTotal = bars.reduce((sum, b) => sum + totalOf(b), 0);
  const seriesLabel = (s: TrendSeries): string => `${s.name} · ${t(s.kind === 'monthly' ? 'owner.dashboard.subscriptions.monthly' : 'owner.dashboard.subscriptions.annual')}`;
  const monthName = capitalize(new Date().toLocaleDateString(locale, { month: 'long' }));

  const plotH = TREND_H - TREND_TOP - TREND_BOTTOM;
  const plotW = TREND_W - TREND_LEFT;
  const slotW = plotW / Math.max(1, bars.length);
  const barW = Math.min(110, slotW * 0.6);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 1, 2, 3, 4].map((i) => Math.round((max / 4) * i));
  const yOf = (v: number): number => TREND_TOP + plotH - (v / max) * plotH;

  // The same chart as words, for screen readers.
  const summary = bars
    .map((b) => {
      const parts = series.filter((s) => (b.values[s.key] ?? 0) > 0).map((s) => `${seriesLabel(s)}: ${b.values[s.key]}`);
      return `${b.label} ${b.sub}: ${parts.length > 0 ? parts.join(', ') : '0'}`;
    })
    .join('. ');

  return (
    <View style={{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <IconBadge icon={PulseIcon} tint={theme.primary} />
        <View style={{ flex: 1, minWidth: 180, gap: 1 }}>
          <AppText style={{ fontWeight: '700', fontSize: 16 }}>{view === 'monthly' ? t('owner.dashboard.trend.titleMonthly', { month: monthName }) : t('owner.dashboard.trend.titleAnnual')}</AppText>
          <AppText variant="caption" muted>
            {t('owner.dashboard.trend.hint')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['monthly', 'annual'] as const).map((v) => {
            const selected = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{ minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.surfaceAlt : 'transparent' }}>
                <AppText style={{ fontWeight: '700', fontSize: 13, color: selected ? theme.primary : theme.text }}>{t(v === 'monthly' ? 'owner.dashboard.subscriptions.monthly' : 'owner.dashboard.subscriptions.annual')}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color }} />
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {seriesLabel(s)}
            </AppText>
          </View>
        ))}
      </View>

      {grandTotal === 0 ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('owner.dashboard.trend.empty')}
        </AppText>
      ) : null}

      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        <Svg width="100%" viewBox={`0 0 ${TREND_W} ${TREND_H}`} style={{ aspectRatio: TREND_W / TREND_H }}>
          {ticks.map((tv) => (
            <React.Fragment key={tv}>
              <Line x1={TREND_LEFT} y1={yOf(tv)} x2={TREND_W} y2={yOf(tv)} stroke={theme.glassBorder} strokeWidth={1} />
              <SvgText x={TREND_LEFT - 8} y={yOf(tv) + 4} fontSize={11} textAnchor="end" fill={theme.textMuted}>
                {tv}
              </SvgText>
            </React.Fragment>
          ))}
          {bars.map((b, bi) => {
            const cx = TREND_LEFT + bi * slotW + slotW / 2;
            const x = cx - barW / 2;
            const total = totalOf(b);
            let acc = 0;
            return (
              <React.Fragment key={b.key}>
                {series.map((s) => {
                  const v = b.values[s.key] ?? 0;
                  if (v <= 0) return null;
                  const yTop = yOf(acc + v);
                  const h = yOf(acc) - yTop;
                  acc += v;
                  return (
                    <React.Fragment key={s.key}>
                      <Rect x={x} y={yTop} width={barW} height={h} fill={s.color} stroke={theme.background} strokeWidth={1.5} />
                      {h >= 18 ? (
                        <SvgText x={cx} y={yTop + h / 2 + 5} fontSize={13} fontWeight="700" textAnchor="middle" fill="#FFFFFF">
                          {v}
                        </SvgText>
                      ) : null}
                    </React.Fragment>
                  );
                })}
                <SvgText x={cx} y={yOf(total) - 8} fontSize={13} fontWeight="700" textAnchor="middle" fill={total > 0 ? theme.text : theme.textMuted}>
                  {t('owner.dashboard.trend.totals', { count: total })}
                </SvgText>
                <SvgText x={cx} y={TREND_TOP + plotH + 20} fontSize={13} fontWeight="700" textAnchor="middle" fill={theme.text}>
                  {b.label}
                </SvgText>
                <SvgText x={cx} y={TREND_TOP + plotH + 38} fontSize={12} textAnchor="middle" fill={theme.textMuted}>
                  {b.sub}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

export function OwnerDashboardScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const isSidebar = useSidebarMode();
  const overview = useAsync(() => getOwnerOverview(), []);
  const billing = useAsync(() => getOwnerPlanBilling(), []);
  const trend = useAsync(() => getOwnerSubscriptionTrend(12), []);
  const weeks = useAsync(() => getOwnerSubscriptionWeeks(), []);
  const [detailsOpen, setDetailsOpen] = useState(false);
  usePageHeader(PulseIcon, t('owner.dashboard.title'));

  // Only while the automatic 3-day window is running: the server flips `warningSent` once the last 24h
  // begin, which is what turns this from a heads-up into the "pay now or we deactivate you" notice.
  // Plain text on a Banner (icon + words), never colour alone.
  const graceEnd = billing.data?.status === 'grace' && billing.data.graceEnd ? new Date(billing.data.graceEnd) : null;
  const graceEndLabel = graceEnd ? graceEnd.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const revenueLabel = overview.data ? `€${overview.data.revenueEur.toLocaleString('it-IT')}` : '—';

  return (
    <Screen onRefresh={overview.reload} refreshing={overview.loading && overview.data !== undefined}>
      {!isSidebar ? (
        <View style={{ paddingTop: spacing.xxl, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBadge icon={PulseIcon} tint={theme.primary} size={32} />
            <AppText style={{ fontFamily: fontFamily.displaySemi, fontSize: 24, lineHeight: 29, letterSpacing: 24 * -0.04 }}>{t('owner.dashboard.title')}</AppText>
          </View>
          <AppText muted style={{ fontSize: 14 }}>
            {t('owner.dashboard.subtitle')}
          </AppText>
        </View>
      ) : null}

      {graceEnd ? (
        <Banner
          title={t(billing.data?.warningSent ? 'owner.billing.lastDay.title' : 'owner.billing.grace.title')}
          message={t(billing.data?.warningSent ? 'owner.billing.lastDay.body' : 'owner.billing.grace.body', { date: graceEndLabel })}
        />
      ) : null}

      {overview.error ? <Banner title={t('owner.dashboard.error')} /> : null}

      {overview.data ? (
        <FadeSlideIn>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <KpiCard index={0} icon={DumbbellIcon} tint={theme.primary} label={t('owner.dashboard.managers')} value={String(overview.data.managers)} />
              <KpiCard index={1} icon={UsersIcon} tint={theme.band.green.solid} label={t('owner.dashboard.clients')} value={String(overview.data.clients)} />
              <KpiCard index={2} icon={UsersIcon} tint={theme.band.amber.solid} label={t('owner.dashboard.coaches')} value={String(overview.data.coaches)} />
              <KpiCard index={3} icon={CreditCardIcon} tint={theme.primaryDeep} label={t('owner.dashboard.revenue')} value={revenueLabel} onPress={() => setDetailsOpen(true)} />
            </View>
            {trend.data ? <SubscriptionTrendCard months={trend.data} weeks={weeks.data ?? []} /> : null}
          </View>
        </FadeSlideIn>
      ) : null}
      <SubscriptionDetailsModal visible={detailsOpen} rows={overview.data?.subscriptions ?? []} total={revenueLabel} onClose={() => setDetailsOpen(false)} />
    </Screen>
  );
}

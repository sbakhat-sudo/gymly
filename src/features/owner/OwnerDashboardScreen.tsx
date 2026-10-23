import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { ChevronRightIcon, CreditCardIcon, DumbbellIcon, PulseIcon, UsersIcon, XIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getOwnerOverview, getOwnerPlanBilling, getOwnerSubscriptionTrend, type OwnerSubscriptionRow, type OwnerSubscriptionTrendPoint } from './owner-api';

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

const TIERS = ['normal', 'vip', 'vvip'] as const;
const TIER_LABEL_KEY = { normal: 'owner.dashboard.tier.normal', vip: 'owner.dashboard.tier.vip', vvip: 'owner.dashboard.tier.vvip' } as const;

/** The grid itself: Mensile/Annuale across, Normale/VIP/VVIP down — each cell the number of people on it and
 * what they pay. Every cell is always there (zeros included) so the picture never rearranges itself as
 * members come and go. Numbers and words only, no colour coding to decode. */
function SubscriptionGrid({ rows }: { rows: OwnerSubscriptionRow[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const money = (n: number): string => `€${n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}`;
  const cell = (kind: 'monthly' | 'annual', tier: (typeof TIERS)[number]): OwnerSubscriptionRow =>
    rows.find((r) => r.kind === kind && r.tier === tier) ?? { kind, tier, count: 0, revenueEur: 0 };
  const kindLabel = (kind: 'monthly' | 'annual'): string => t(kind === 'monthly' ? 'owner.dashboard.subscriptions.monthly' : 'owner.dashboard.subscriptions.annual');

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 0.7 }} />
        {(['monthly', 'annual'] as const).map((kind) => (
          <View key={kind} style={{ flex: 1 }}>
            <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {kindLabel(kind)}
            </AppText>
          </View>
        ))}
      </View>

      {TIERS.map((tier) => (
        <View key={tier} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.glassBorder }}>
          <View style={{ flex: 0.7 }}>
            <AppText style={{ fontWeight: '700', fontSize: 14 }}>{t(TIER_LABEL_KEY[tier])}</AppText>
          </View>
          {(['monthly', 'annual'] as const).map((kind) => {
            const c = cell(kind, tier);
            return (
              <View key={kind} style={{ flex: 1 }} accessible accessibilityLabel={`${t(TIER_LABEL_KEY[tier])}, ${kindLabel(kind)}: ${t('owner.dashboard.subscriptions.people', { count: c.count })}, ${money(c.revenueEur)}`}>
                <AppText style={{ fontFamily: fontFamily.displaySemi, fontSize: 22, lineHeight: 26 }}>{c.count}</AppText>
                <AppText variant="caption" muted>
                  {money(c.revenueEur)}
                </AppText>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** What opens when the Owner taps "Fatturato": the total, then who is on which kind of plan. */
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

          <View style={{ gap: 2 }}>
            <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {t('owner.dashboard.revenue')}
            </AppText>
            <AppText style={{ fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36 }}>{total}</AppText>
          </View>

          <SubscriptionGrid rows={rows} />
        </View>
      </View>
    </Modal>
  );
}

// Same palette the Manager's plan editor uses (Durata x Livello) — one plan, one colour, everywhere. The legend
// and the numbers on the bars carry the meaning too, never the colour alone.
const TREND_COLORS: Record<'monthly' | 'annual', Record<(typeof TIERS)[number], string>> = {
  monthly: { normal: '#8B5CF6', vip: '#F97316', vvip: '#3B82F6' },
  annual: { normal: '#EAB308', vip: '#EF4444', vvip: '#22C55E' },
};
const TREND_SERIES = (['monthly', 'annual'] as const).flatMap((kind) => TIERS.map((tier) => ({ kind, tier })));

const TREND_W = 720;
const TREND_H = 250;
const TREND_TOP = 26;
const TREND_BOTTOM = 52;

/** Subscriptions per month: for each of the last months a group of six bars (Mensile/Annuale x Normale/VIP/VVIP,
 * always in the same order), the number of subscriptions paid or renewed written above every bar, and the
 * month's total underneath its name. Hand-rolled SVG like the other charts in this app. */
function SubscriptionTrendCard({ points }: { points: OwnerSubscriptionTrendPoint[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  const months = Array.from(new Set(points.map((p) => p.monthStart)));
  const count = (month: string, kind: 'monthly' | 'annual', tier: (typeof TIERS)[number]): number =>
    points.find((p) => p.monthStart === month && p.kind === kind && p.tier === tier)?.subscribers ?? 0;
  const max = Math.max(1, ...points.map((p) => p.subscribers));
  const grandTotal = points.reduce((sum, p) => sum + p.subscribers, 0);

  const plotH = TREND_H - TREND_TOP - TREND_BOTTOM;
  const groupW = TREND_W / Math.max(1, months.length);
  const barW = Math.min(30, (groupW * 0.84) / TREND_SERIES.length);
  const groupInner = barW * TREND_SERIES.length;
  const monthLabel = (iso: string): string => {
    const label = new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'short' });
    return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
  };
  const seriesLabel = (kind: 'monthly' | 'annual', tier: (typeof TIERS)[number]): string =>
    `${t(kind === 'monthly' ? 'owner.dashboard.subscriptions.monthly' : 'owner.dashboard.subscriptions.annual')} · ${t(TIER_LABEL_KEY[tier])}`;

  // The same chart as words, for screen readers.
  const summary = months
    .map((m) => {
      const parts = TREND_SERIES.filter((s) => count(m, s.kind, s.tier) > 0).map((s) => `${seriesLabel(s.kind, s.tier)}: ${count(m, s.kind, s.tier)}`);
      return `${monthLabel(m)}: ${parts.length > 0 ? parts.join(', ') : '0'}`;
    })
    .join('. ');

  return (
    <View style={{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge icon={PulseIcon} tint={theme.primary} />
        <View style={{ flexShrink: 1, gap: 1 }}>
          <AppText style={{ fontWeight: '700', fontSize: 16 }}>{t('owner.dashboard.trend.title')}</AppText>
          <AppText variant="caption" muted>
            {t('owner.dashboard.trend.hint')}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TREND_SERIES.map((s) => (
          <View key={`${s.kind}-${s.tier}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: TREND_COLORS[s.kind][s.tier] }} />
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {seriesLabel(s.kind, s.tier)}
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
          <Line x1={0} y1={TREND_TOP + plotH} x2={TREND_W} y2={TREND_TOP + plotH} stroke={theme.glassBorder} strokeWidth={1} />
          {months.map((m, mi) => {
            const gx = mi * groupW + (groupW - groupInner) / 2;
            const monthTotal = TREND_SERIES.reduce((sum, s) => sum + count(m, s.kind, s.tier), 0);
            return (
              <React.Fragment key={m}>
                {TREND_SERIES.map((s, si) => {
                  const v = count(m, s.kind, s.tier);
                  const h = (v / max) * plotH;
                  const x = gx + si * barW;
                  return (
                    <React.Fragment key={`${s.kind}-${s.tier}`}>
                      {v > 0 ? <Rect x={x + 1} y={TREND_TOP + plotH - h} width={Math.max(2, barW - 2)} height={h} rx={3} fill={TREND_COLORS[s.kind][s.tier]} /> : null}
                      <SvgText x={x + barW / 2} y={TREND_TOP + plotH - h - 6} fontSize={12} fontWeight={v > 0 ? '700' : '400'} textAnchor="middle" fill={v > 0 ? theme.text : theme.textMuted}>
                        {v}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
                <SvgText x={mi * groupW + groupW / 2} y={TREND_TOP + plotH + 20} fontSize={14} fontWeight="700" textAnchor="middle" fill={theme.text}>
                  {monthLabel(m)}
                </SvgText>
                <SvgText x={mi * groupW + groupW / 2} y={TREND_TOP + plotH + 38} fontSize={12} textAnchor="middle" fill={theme.textMuted}>
                  {t('owner.dashboard.trend.total', { count: monthTotal })}
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
  const trend = useAsync(() => getOwnerSubscriptionTrend(6), []);
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
            {trend.data ? <SubscriptionTrendCard points={trend.data} /> : null}
          </View>
        </FadeSlideIn>
      ) : null}
      <SubscriptionDetailsModal visible={detailsOpen} rows={overview.data?.subscriptions ?? []} total={revenueLabel} onClose={() => setDetailsOpen(false)} />
    </Screen>
  );
}

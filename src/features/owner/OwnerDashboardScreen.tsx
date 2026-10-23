import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

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

import { getOwnerOverview, getOwnerPlanBilling, type OwnerSubscriptionRow } from './owner-api';

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

const CHART_W = 320;
const CHART_H = 110;
const CHART_PAD = 10;

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

/** Same hand-rolled SVG "stock chart" as Admin's TrendLineCard, adapted from 12 months to 7 days. */
function ActivityTrendCard({ data }: { data: { day: string; count: number }[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  if (data.length === 0) return null;

  const values = data.map((d) => d.count);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = data.length;
  const points = data.map((d, i) => {
    const x = ((i + 0.5) / n) * CHART_W;
    const y = CHART_PAD + (1 - (d.count - min) / range) * (CHART_H - 2 * CHART_PAD);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${CHART_H} L${points[0]?.x ?? 0},${CHART_H} Z`;
  const tint = theme.primary;

  return (
    <View style={{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconBadge icon={PulseIcon} tint={tint} size={26} />
        <AppText style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{t('owner.dashboard.activity.title')}</AppText>
      </View>

      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="ownerActivityFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#ownerActivityFill)" stroke="none" />
        <Path d={linePath} fill="none" stroke={tint} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>

      <View style={{ flexDirection: 'row' }}>
        {data.map((d) => (
          <AppText key={d.day} variant="caption" muted style={{ flex: 1, textAlign: 'center', fontSize: 10, textTransform: 'capitalize' }}>
            {new Date(`${d.day}T00:00:00`).toLocaleDateString(lang, { weekday: 'short' })}
          </AppText>
        ))}
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
            <ActivityTrendCard data={overview.data.activity7d} />
          </View>
        </FadeSlideIn>
      ) : null}
      <SubscriptionDetailsModal visible={detailsOpen} rows={overview.data?.subscriptions ?? []} total={revenueLabel} onClose={() => setDetailsOpen(false)} />
    </Screen>
  );
}

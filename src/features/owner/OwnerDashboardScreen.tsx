import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { CreditCardIcon, DumbbellIcon, PulseIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getOwnerOverview, getOwnerPlanBilling } from './owner-api';

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
function KpiCard({ index, icon, tint, label, value }: { index: number; icon: IconType; tint: string; label: string; value: string }) {
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

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flexBasis: '47%', flexGrow: 1 }}>
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
        </View>
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, color: theme.text }}>{value}</AppText>
      </View>
    </Animated.View>
  );
}

const CHART_W = 320;
const CHART_H = 110;
const CHART_PAD = 10;

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
              <KpiCard index={3} icon={CreditCardIcon} tint={theme.primaryDeep} label={t('owner.dashboard.revenue')} value={revenueLabel} />
            </View>
            <ActivityTrendCard data={overview.data.activity7d} />
          </View>
        </FadeSlideIn>
      ) : null}
    </Screen>
  );
}

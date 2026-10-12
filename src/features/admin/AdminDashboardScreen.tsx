import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { BellIcon, CheckIcon, CreditCardIcon, DumbbellIcon, PulseIcon, UsersIcon, XIcon } from '@/components/icons';
import { Orb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { decorativeA11yProps } from '@/lib/a11y';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getOverview, getSites, getSitesGrowth, setSiteStatus, type AdminSite, type MonthCount, type SitePlan } from './admin-api';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

const PLAN_ORDER: SitePlan[] = ['trial', 'pro', 'business'];
const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};
/** Same mapping as AdminSitesScreen's row accents — one plan, one colour, everywhere. */
const PLAN_COLOR: Record<SitePlan, (theme: ReturnType<typeof useTheme>) => string> = {
  trial: (theme) => theme.textMuted,
  pro: (theme) => theme.primary,
  business: (theme) => theme.band.amber.solid,
};

/** Small colour-tinted icon badge, the "some colour" accent on every KPI/chart card header. */
function IconBadge({ icon: Icon, tint }: { icon: IconType; tint: string }) {
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${tint}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={tint} size={14} />
    </View>
  );
}

export function AdminDashboardScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const overview = useAsync(() => getOverview(), []);
  const sites = useAsync(() => getSites(), []);
  const growth = useAsync(() => getSitesGrowth(12), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = sites.data?.filter((s) => s.approvalStatus === 'pending_approval') ?? [];

  function reloadAll(): void {
    overview.reload();
    sites.reload();
  }

  async function approve(site: AdminSite): Promise<void> {
    setBusyId(site.siteId);
    try {
      await setSiteStatus(site.siteId, 'active');
      reloadAll();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen onRefresh={reloadAll} refreshing={(overview.loading || sites.loading) && overview.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: 4, flex: 1 }}>
          <AppText style={{ fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36, letterSpacing: 32 * -0.03 }}>{t('admin.dashboard.title')}</AppText>
          <AppText muted style={{ fontSize: 14 }}>
            {t('admin.dashboard.subtitle')}
          </AppText>
        </View>
        <NotificationBell count={(overview.data?.sitesPending ?? 0) + (overview.data?.managersPending ?? 0)} onPress={() => router.push('/(admin)/manager')} />
      </View>

      {overview.error ? <Banner title={t('admin.sites.error')} /> : null}

      {overview.data ? (
        <FadeSlideIn>
          <HeroCard count={overview.data.sitesPending} pending={pending} busyId={busyId} onApprove={approve} onPress={() => router.push('/(admin)/palestre')} />
        </FadeSlideIn>
      ) : null}

      {overview.data ? (
        <>
          <GroupHeader icon={DumbbellIcon} label={t('admin.dashboard.group.sites')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={0}
              icon={DumbbellIcon}
              tint={theme.primary}
              label={t('admin.dashboard.sitesTotal')}
              value={overview.data.sitesActive + overview.data.sitesSuspended + overview.data.sitesPending}
              onPress={() => router.push('/(admin)/palestre')}
            />
            <KpiCard
              index={1}
              icon={CheckIcon}
              tint={theme.band.green.solid}
              label={t('admin.overview.sitesActive')}
              value={overview.data.sitesActive}
              onPress={() => router.push('/(admin)/palestre')}
            />
            <KpiCard
              index={2}
              icon={XIcon}
              tint={theme.danger}
              label={t('admin.sites.status.suspended')}
              value={overview.data.sitesSuspended}
              onPress={() => router.push('/(admin)/palestre')}
            />
          </View>

          {growth.data ? (
            <FadeSlideIn delay={140}>
              <TrendLineCard title={t('admin.dashboard.growth.title')} tint={theme.primary} data={growth.data} onPress={() => router.push('/(admin)/palestre')} />
            </FadeSlideIn>
          ) : null}

          {sites.data ? (
            <FadeSlideIn delay={210}>
              <PlanPieChart sites={sites.data} onPress={() => router.push('/(admin)/palestre')} />
            </FadeSlideIn>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={3}
              icon={UsersIcon}
              tint={theme.primary}
              label={t('admin.overview.managersTotal')}
              value={overview.data.managersTotal}
              wide
              onPress={() => router.push('/(admin)/manager')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={4}
              icon={CheckIcon}
              tint={theme.band.green.solid}
              label={t('admin.overview.managersActive')}
              value={overview.data.managersActive}
              wide
              onPress={() => router.push('/(admin)/manager')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={5}
              icon={XIcon}
              tint={theme.danger}
              label={t('admin.overview.managersInactive')}
              value={overview.data.managersTotal - overview.data.managersActive}
              wide
              onPress={() => router.push('/(admin)/manager')}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** Bell shortcut to the thing the admin most needs to act on right now (pending gym approvals). */
function NotificationBell({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? t('admin.dashboard.pendingApprovals') : t('admin.dashboard.title')}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.85 : 1,
      })}>
      <BellIcon color={theme.text} size={20} />
      {count > 0 ? (
        <View
          {...decorativeA11yProps}
          style={{
            position: 'absolute',
            top: 6,
            right: 7,
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: theme.danger,
            borderWidth: 1.5,
            borderColor: theme.background,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function GroupHeader({ icon: Icon, label }: { icon: IconType; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
      <Icon color={theme.textMuted} size={14} />
      <AppText muted style={{ fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
        {label}
      </AppText>
    </View>
  );
}

function HeroCard({
  count,
  pending,
  busyId,
  onApprove,
  onPress,
}: {
  count: number;
  pending: AdminSite[];
  busyId: string | null;
  onApprove: (site: AdminSite) => void;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const calm = count === 0;
  const glow = calm ? theme.band.green.solid : theme.band.amber.solid;

  return (
    <View style={{ borderRadius: 30, padding: 20, gap: 14, backgroundColor: theme.surface, overflow: 'hidden' }}>
      <View {...decorativeA11yProps} style={{ pointerEvents: 'none', position: 'absolute', top: -110, right: -90, width: 280, height: 280 }}>
        <Orb color={glow} size={280} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <AppText muted accessibilityRole="header" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
          {t('admin.dashboard.pendingApprovals')}
        </AppText>
        <AppText
          accessibilityRole="link"
          onPress={onPress}
          style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
          {t('admin.dashboard.pendingApprovals.seeAll')}
        </AppText>
      </View>

      <AppText
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fontFamily.display, fontSize: 58, lineHeight: 58, letterSpacing: 58 * -0.07, fontVariant: ['tabular-nums'] }}>
        {count}
      </AppText>

      {calm ? (
        <AppText muted style={{ fontSize: 14 }}>
          {t('admin.dashboard.pendingApprovals.empty')}
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pending.slice(0, 3).map((s) => (
            <View key={s.siteId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText style={{ fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {s.name}
              </AppText>
              <Pressable
                onPress={() => onApprove(s)}
                disabled={busyId === s.siteId}
                accessibilityRole="button"
                accessibilityLabel={`${t('admin.sites.approve')}: ${s.name}`}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 16,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.text,
                  opacity: busyId === s.siteId ? 0.5 : pressed ? 0.85 : 1,
                })}>
                <AppText color={theme.background} style={{ fontSize: 13, fontWeight: '700' }}>
                  {t('admin.sites.approve')}
                </AppText>
              </Pressable>
            </View>
          ))}
          {pending.length > 3 ? (
            <AppText variant="caption" muted>
              {t('admin.dashboard.pendingApprovals.more', { count: pending.length - 3 })}
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const PIE_SIZE = 150;
const PIE_R = PIE_SIZE / 2;

function polarPoint(angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: PIE_R + PIE_R * Math.cos(rad), y: PIE_R + PIE_R * Math.sin(rad) };
}

function pieSlicePath(startAngle: number, endAngle: number): string {
  const start = polarPoint(startAngle);
  const end = polarPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M${PIE_R},${PIE_R} L${start.x},${start.y} A${PIE_R},${PIE_R} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
}

/** Real per-plan gym split (trial/pro/business) as a pie, with a text+colour legend (never colour alone). */
function PlanPieChart({ sites, onPress }: { sites: AdminSite[]; onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  const counts: Record<SitePlan, number> = { trial: 0, pro: 0, business: 0 };
  for (const s of sites) counts[s.plan] += 1;
  const total = counts.trial + counts.pro + counts.business;

  const nonEmpty = PLAN_ORDER.filter((p) => counts[p] > 0);
  const slices = nonEmpty.reduce<{ plan: SitePlan; start: number; end: number }[]>((acc, plan) => {
    const start = acc.length > 0 ? (acc[acc.length - 1]?.end ?? 0) : 0;
    const sweep = (counts[plan] / total) * 360;
    return [...acc, { plan, start, end: start + sweep }];
  }, []);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('admin.dashboard.plans.title')}
      style={({ pressed }) => ({
        borderRadius: radius.card,
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.9 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconBadge icon={CreditCardIcon} tint={theme.band.amber.solid} />
        <AppText style={{ fontSize: 13, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 13 * 0.06, flex: 1 }} numberOfLines={1}>
          {t('admin.dashboard.plans.title')}
        </AppText>
      </View>

      {total === 0 ? (
        <AppText muted style={{ fontSize: 14 }}>
          {t('admin.dashboard.plans.empty')}
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
            {slices.length === 1 ? (
              <Circle cx={PIE_R} cy={PIE_R} r={PIE_R - 1} fill={PLAN_COLOR[slices[0]?.plan ?? 'trial'](theme)} />
            ) : (
              slices.map((s) => (
                <Path key={s.plan} d={pieSlicePath(s.start, s.end)} fill={PLAN_COLOR[s.plan](theme)} stroke={theme.background} strokeWidth={2} strokeLinejoin="round" />
              ))
            )}
          </Svg>
          <View style={{ gap: spacing.sm, flex: 1 }}>
            {PLAN_ORDER.filter((p) => counts[p] > 0).map((plan) => (
              <View key={plan} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View {...decorativeA11yProps} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PLAN_COLOR[plan](theme) }} />
                <AppText style={{ fontSize: 14, fontWeight: '600', flex: 1 }}>{t(PLAN_LABEL_KEY[plan])}</AppText>
                <AppText variant="caption" muted>
                  {counts[plan]}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const CHART_W = 320;
const CHART_H = 96;
const CHART_PAD = 10;

/** "Stock chart" card: a filled line through a real monthly count, with a trend badge comparing the last two months. */
function TrendLineCard({ title, tint, data, onPress }: { title: string; tint: string; data: MonthCount[]; onPress: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  if (data.length === 0) return null;
  const gradientId = `trendFill-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

  const values = data.map((d) => d.count);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = data.length;
  const points = data.map((d, i) => {
    // Matches the month labels below exactly: n equal-width columns, each point centred under
    // its own column — same distribution `flex: 1` + `textAlign: 'center'` gives each label.
    const x = ((i + 0.5) / n) * CHART_W;
    const y = CHART_PAD + (1 - (d.count - min) / range) * (CHART_H - 2 * CHART_PAD);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${CHART_H} L${points[0]?.x ?? 0},${CHART_H} Z`;

  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  const delta = last - prev;
  const trendColor = delta > 0 ? theme.band.green.solid : delta < 0 ? theme.danger : theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        borderRadius: radius.card,
        padding: spacing.lg,
        gap: spacing.sm,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconBadge icon={PulseIcon} tint={tint} />
        <AppText style={{ fontSize: 15, fontWeight: '700', color: theme.text }} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <AppText muted style={{ fontSize: 12, marginTop: -6 }}>
        {t('admin.dashboard.last12months')}
      </AppText>

      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={trendColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <Path d={linePath} fill="none" stroke={trendColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>

      <View style={{ flexDirection: 'row' }}>
        {data.map((d) => (
          <AppText key={d.monthKey} variant="caption" muted style={{ flex: 1, textAlign: 'center', fontSize: 10, textTransform: 'capitalize' }}>
            {new Date(`${d.monthKey}-01T00:00:00`).toLocaleDateString(lang, { month: 'short' })}
          </AppText>
        ))}
      </View>
    </Pressable>
  );
}

function KpiCard({
  index,
  icon,
  tint,
  label,
  value,
  wide = false,
  onPress,
}: {
  index: number;
  icon: IconType;
  tint: string;
  label: string;
  value: number;
  wide?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 420, delay: index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, progress, index]);

  function animateScale(toValue: number): void {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }

  const opacity = progress;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const glow: ViewStyle = Platform.OS === 'web' ? ({ boxShadow: `0 8px 24px -12px rgba(0,0,0,0.25)` } as ViewStyle) : {};

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }], flexGrow: wide ? 1 : undefined, flexBasis: wide ? '100%' : 0, flex: wide ? undefined : 1 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        onHoverIn={() => animateScale(1.03)}
        onHoverOut={() => animateScale(1)}
        onPressIn={() => animateScale(0.97)}
        onPressOut={() => animateScale(1)}
        style={[
          {
            borderRadius: radius.card,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            gap: 2,
            backgroundColor: theme.glass,
            borderWidth: 1,
            borderColor: theme.glassBorder,
          },
          glow,
        ]}>
        <IconBadge icon={icon} tint={tint} />
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, color: theme.text, marginTop: 6 }}>{value}</AppText>
        <AppText variant="caption" muted>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

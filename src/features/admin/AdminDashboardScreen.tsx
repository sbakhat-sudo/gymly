import { useRouter } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { GroupHeader } from '@/components/GroupHeader';
import { CheckIcon, ChevronDownIcon, ClockIcon, CreditCardIcon, InboxIcon, LayersIcon, PulseIcon, UsersIcon, XIcon } from '@/components/icons';
import { NotificationBell } from '@/components/NotificationBell';
import { Screen } from '@/components/Screen';
import { decorativeA11yProps } from '@/lib/a11y';
import { formatRelativeTime } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { AdminActionRow } from './AdminActionRow';
import {
  getActionsLog,
  getOverview,
  getOwners,
  getPendingOwners,
  getSites,
  getSitesGrowth,
  setOwnerStatus,
  type AdminSite,
  type MonthCount,
  type PendingManager,
  type SitePlan,
} from './admin-api';

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
/** The readable text colour for each slice's own "{pct}%" label — `pro`/`business` reuse the
 * theme's already-contrast-tested `onPrimary`/`band.amber.onSolid` pairs (amber in particular needs
 * this: it's a bright yellow in dark mode, where white text would fail, not the dark brown it is in
 * light mode); `trial`'s fill is a plain mid-grey with no built-in "on" partner, so `background` — the
 * theme's own lightest/darkest extreme — stands in instead. */
const PLAN_LABEL_COLOR: Record<SitePlan, (theme: ReturnType<typeof useTheme>) => string> = {
  trial: (theme) => theme.background,
  pro: (theme) => theme.onPrimary,
  business: (theme) => theme.band.amber.onSolid,
};

/** Small colour-tinted icon badge, the "some colour" accent on every KPI/chart card header. */
function IconBadge({ icon: Icon, tint, size = 26 }: { icon: IconType; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={tint} size={Math.round(size * 0.54)} />
    </View>
  );
}

export function AdminDashboardScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const overview = useAsync(() => getOverview(), []);
  const sites = useAsync(() => getSites(), []);
  const owners = useAsync(() => getOwners(), []);
  const pendingOwners = useAsync(() => getPendingOwners(), []);
  const growth = useAsync(() => getSitesGrowth(12), []);
  const actionsLog = useAsync(() => getActionsLog(12), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSidebar = useSidebarMode();
  // This screen's own header (icon + title + subtitle + pending-approvals bell) is custom, not the
  // shared `PageTitle`/`ScreenHeader` — kept as-is below for narrow/native. Sidebar mode's fixed
  // `RoleTopBar` still needs a title while this tab is active.
  usePageHeader(PulseIcon, t('admin.dashboard.title'));

  function reloadAll(): void {
    overview.reload();
    sites.reload();
    owners.reload();
    pendingOwners.reload();
  }

  async function approveOwner(owner: PendingManager): Promise<void> {
    setBusyId(owner.userId);
    try {
      await setOwnerStatus(owner.userId, 'active');
      reloadAll();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen onRefresh={reloadAll} refreshing={(overview.loading || sites.loading) && overview.data !== undefined}>
      {!isSidebar ? (
        <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ gap: 4, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBadge icon={PulseIcon} tint={theme.primary} size={32} />
              <AppText style={{ fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36, letterSpacing: 32 * -0.03 }}>{t('admin.dashboard.title')}</AppText>
            </View>
            <AppText muted style={{ fontSize: 14 }}>
              {t('admin.dashboard.subtitle')}
            </AppText>
          </View>
          <NotificationBell
            count={overview.data?.ownersPending ?? 0}
            onPress={() => router.push('/(admin)/manager')}
            accessibilityLabel={(overview.data?.ownersPending ?? 0) > 0 ? t('admin.dashboard.pendingApprovals') : t('admin.dashboard.title')}
          />
        </View>
      ) : null}

      {overview.error ? <Banner title={t('admin.sites.error')} /> : null}

      {overview.data ? (
        <FadeSlideIn>
          <View style={{ gap: spacing.sm }}>
            <GroupHeader icon={InboxIcon} label={t('admin.dashboard.group.action')} />
            <ActionHeroCard ownersPending={pendingOwners.data ?? []} busyId={busyId} onApproveOwner={approveOwner} onSeeAll={() => router.push('/(admin)/manager')} />
          </View>
        </FadeSlideIn>
      ) : null}

      {overview.data && owners.data ? (
        <>
          <GroupHeader icon={LayersIcon} label={t('admin.dashboard.group.status')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={0}
              icon={LayersIcon}
              tint={theme.primary}
              label={t('admin.dashboard.ownersTotal')}
              value={owners.data.length}
              onPress={() => router.push('/(admin)/owners')}
            />
            <KpiCard
              index={1}
              icon={CheckIcon}
              tint={theme.band.green.solid}
              label={t('admin.dashboard.ownersActive')}
              value={owners.data.filter((o) => o.status === 'active' && o.planStatus !== 'grace').length}
              onPress={() => router.push('/(admin)/owners')}
            />
            <KpiCard
              index={2}
              icon={ClockIcon}
              tint={theme.band.amber.solid}
              label={t('admin.dashboard.ownersGrace')}
              value={owners.data.filter((o) => o.planStatus === 'grace').length}
              onPress={() => router.push('/(admin)/owners')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiCard
              index={3}
              icon={XIcon}
              tint={theme.danger}
              label={t('admin.dashboard.ownersDeactivated')}
              value={owners.data.filter((o) => o.status === 'rejected').length}
              onPress={() => router.push('/(admin)/owners')}
            />
            <KpiCard
              index={4}
              icon={UsersIcon}
              tint={theme.primary}
              label={t('admin.overview.managersTotal')}
              value={overview.data.managersTotal}
              onPress={() => router.push('/(admin)/owners')}
            />
            <KpiCard
              index={5}
              icon={CheckIcon}
              tint={theme.band.green.solid}
              label={t('admin.overview.managersActive')}
              value={overview.data.managersActive}
              onPress={() => router.push('/(admin)/owners')}
            />
          </View>
        </>
      ) : null}

      <GroupHeader icon={PulseIcon} label={t('admin.dashboard.group.activity')} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        {sites.data ? (
          <View style={{ flex: 1, minWidth: 280 }}>
            <FadeSlideIn delay={140}>
              <PlanPieChart sites={sites.data} onPress={() => router.push('/(admin)/owners')} />
            </FadeSlideIn>
          </View>
        ) : null}

        {growth.data ? (
          <View style={{ flex: 1, minWidth: 280 }}>
            <FadeSlideIn delay={210}>
              <TrendLineCard title={t('admin.dashboard.growth.title')} tint={theme.primary} data={growth.data} onPress={() => router.push('/(admin)/owners')} />
            </FadeSlideIn>
          </View>
        ) : null}
      </View>

      {actionsLog.error ? <Banner title={t('admin.actionsLog.error')} /> : null}
      {actionsLog.data ? (
        <FadeSlideIn delay={260}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <GroupHeader icon={ClockIcon} label={t('admin.actionsLog.title')} />
              <AppText accessibilityRole="link" onPress={() => router.push('/azioni-admin')} style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
                {t('admin.actionsLog.seeAll')}
              </AppText>
            </View>
            {actionsLog.data.length === 0 ? (
              <AppText muted style={{ fontSize: 14 }}>
                {t('admin.actionsLog.empty')}
              </AppText>
            ) : (
              <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
                {actionsLog.data.map((entry, i, rows) => (
                  <AdminActionRow key={entry.id} entry={entry} last={i === rows.length - 1} />
                ))}
              </View>
            )}
          </View>
        </FadeSlideIn>
      ) : null}
    </Screen>
  );
}

/**
 * "ACTION" hero — a gradient card (the app's own `primary`→`primaryDeep` pair, the one gradient this
 * design system already defines, instead of inventing a one-off orange/red) with a tabbed request
 * list (sites / managers) so both kinds of pending approval live in one place, each row offering an
 * inline "Approva" (acts immediately, no navigation) and "Dettagli" (opens the full Richieste page,
 * where every pending item already has its own detail sheet — no need to duplicate that here).
 */
function ActionHeroCard({
  ownersPending,
  busyId,
  onApproveOwner,
  onSeeAll,
}: {
  ownersPending: PendingManager[];
  busyId: string | null;
  onApproveOwner: (owner: PendingManager) => void;
  onSeeAll: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const total = ownersPending.length;

  return (
    // `backgroundColor` here is a deliberate fallback, not decoration: the gradient below is an SVG
    // fill layered on top via `absoluteFill`, and an SVG `<LinearGradient>` on web can fail to paint
    // (a hydration/timing glitch, not something this app's own code controls) while the white
    // `onPrimary` text above it still renders fine — the card then reads as a near-invisible "washed
    // out" block instead of the blue hero it's meant to be. A solid `theme.primary` base underneath
    // means that failure mode degrades to "flat blue instead of a gradient", never to unreadable text.
    <View style={{ borderRadius: 30, padding: 20, gap: 14, overflow: 'hidden', backgroundColor: theme.primary }}>
      <View {...decorativeA11yProps} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="adminActionHero" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={theme.primary} />
              <Stop offset="100%" stopColor={theme.primaryDeep} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#adminActionHero)" />
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <InboxIcon color={theme.onPrimary} size={13} />
          <AppText
            color={theme.onPrimary}
            style={{ opacity: 0.85, fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
            {t('admin.dashboard.action.heroTitle')}
          </AppText>
        </View>
        <AppText accessibilityRole="link" onPress={onSeeAll} color={theme.onPrimary} style={{ fontWeight: '700', fontSize: 13 }}>
          {t('admin.dashboard.pendingApprovals.seeAll')}
        </AppText>
      </View>

      <AppText
        color={theme.onPrimary}
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fontFamily.display, fontSize: 58, lineHeight: 58, letterSpacing: 58 * -0.07, fontVariant: ['tabular-nums'] }}>
        {total}
      </AppText>

      {ownersPending.length === 0 ? (
        <AppText color={theme.onPrimary} style={{ opacity: 0.85, fontSize: 14 }}>
          {t('admin.dashboard.action.empty.owners')}
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {ownersPending.slice(0, 3).map((o) => (
            <RequestRow
              key={o.userId}
              icon={UsersIcon}
              title={o.fullName ?? t('common.unnamedPerson')}
              subtitle={t('admin.dashboard.action.request.owner')}
              createdAt={o.createdAt}
              busy={busyId === o.userId}
              onApprove={() => onApproveOwner(o)}
              onDetails={onSeeAll}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Opaque white card, not translucent-over-gradient — reads as its own "item", the way each named
 * request sits as a distinct little card on top of the hero in the reference design. */
function RequestRow({
  icon,
  title,
  subtitle,
  createdAt,
  busy,
  onApprove,
  onDetails,
}: {
  icon: IconType;
  title: string;
  subtitle: string;
  createdAt: string;
  busy: boolean;
  onApprove: () => void;
  onDetails: () => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.sm }}>
      <IconBadge icon={icon} tint={theme.primary} size={34} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
          {title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {subtitle} · {formatRelativeTime(lang, createdAt)}
        </AppText>
      </View>
      <Pressable
        onPress={onApprove}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${t('admin.sites.approve')}: ${title}`}
        style={({ pressed }) => ({
          height: 34,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.band.green.solid,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
        })}>
        <AppText color={theme.band.green.onSolid} style={{ fontSize: 12.5, fontWeight: '700' }}>
          {t('admin.sites.approve')}
        </AppText>
      </Pressable>
      <Pressable
        onPress={onDetails}
        accessibilityRole="button"
        accessibilityLabel={`${t('admin.dashboard.action.details')}: ${title}`}
        style={({ pressed }) => ({
          height: 34,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        })}>
        <AppText color={theme.text} style={{ fontSize: 12.5, fontWeight: '700' }}>
          {t('admin.dashboard.action.details')}
        </AppText>
      </Pressable>
    </View>
  );
}

const PIE_SIZE = 150;
const PIE_R = PIE_SIZE / 2;

function polarPoint(angleDeg: number, r: number = PIE_R): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: PIE_R + r * Math.cos(rad), y: PIE_R + r * Math.sin(rad) };
}

function pieSlicePath(startAngle: number, endAngle: number): string {
  const start = polarPoint(startAngle);
  const end = polarPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M${PIE_R},${PIE_R} L${start.x},${start.y} A${PIE_R},${PIE_R} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
}

/** Where a slice's own "{pct}%" label sits — partway out from the centre (not jammed against the
 * middle, not crowding the outer edge), at the slice's own mid-angle. */
function pieLabelPoint(startAngle: number, endAngle: number): { x: number; y: number } {
  return polarPoint((startAngle + endAngle) / 2, PIE_R * 0.64);
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
              <>
                <Circle cx={PIE_R} cy={PIE_R} r={PIE_R - 1} fill={PLAN_COLOR[slices[0]?.plan ?? 'trial'](theme)} />
                <SvgText x={PIE_R} y={PIE_R + 5} textAnchor="middle" fontSize={16} fontWeight="700" fill={PLAN_LABEL_COLOR[slices[0]?.plan ?? 'trial'](theme)}>
                  100%
                </SvgText>
              </>
            ) : (
              slices.map((s) => {
                const pct = Math.round((counts[s.plan] / total) * 100);
                const label = pieLabelPoint(s.start, s.end);
                return (
                  <Fragment key={s.plan}>
                    <Path d={pieSlicePath(s.start, s.end)} fill={PLAN_COLOR[s.plan](theme)} stroke={theme.background} strokeWidth={2} strokeLinejoin="round" />
                    {pct >= 6 ? (
                      <SvgText x={label.x} y={label.y + 4} textAnchor="middle" fontSize={12} fontWeight="700" fill={PLAN_LABEL_COLOR[s.plan](theme)}>
                        {pct}%
                      </SvgText>
                    ) : null}
                  </Fragment>
                );
              })
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
  onPress,
}: {
  index: number;
  icon: IconType;
  tint: string;
  label: string;
  value: number;
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
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }], flex: 1 }}>
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
            gap: 8,
            backgroundColor: theme.glass,
            borderWidth: 1,
            borderColor: theme.glassBorder,
          },
          glow,
        ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconBadge icon={icon} tint={tint} size={34} />
          <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </AppText>
          <ChevronDownIcon color={theme.textMuted} size={14} />
        </View>
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, color: theme.text }}>{value}</AppText>
      </Pressable>
    </Animated.View>
  );
}

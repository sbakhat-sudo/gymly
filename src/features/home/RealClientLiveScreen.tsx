import { useIsFocused } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { GymBandHero } from '@/components/GymBandHero';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { getAnnouncements } from '@/features/announcements/announcements-api';
import { getMySubscription } from '@/features/billing/billing-api';
import { PaymentDueBanner } from '@/features/billing/PaymentDueBanner';
import { ClientNotifications } from '@/features/checkin/ClientNotifications';
import { weekdayOfDateKey, windowsOf } from '@/lib/domain/client-home';
import { addDays, localTime } from '@/lib/domain/time';
import { isGymOpenNow, useLiveGymBand, usePolledSiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { getWeekRealBands } from '@/lib/real-schedule';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { AnnouncementsStrip } from './client/AnnouncementsStrip';
import { ClientPlanCard } from './client/ClientPlanCard';
import { GymHoursCard } from './client/GymHoursCard';
import { RecentHoursCard, type PastState, type RecentHour } from './client/RecentHoursCard';
import { ResolvedIssueBanner } from './ResolvedIssueBanner';
import { WeeklyGoalPopup } from './WeeklyGoalPopup';

/**
 * A real (approved) Client's home: the live band from the member's own gym (`useLiveGymBand`, never a number of
 * people), then notices from the gym, how the gym was in the last two hours, the subscription card they are on and the gym's
 * opening hours (the month's visits live in Storico). Exported so `(client)/index.tsx` can branch on it.
 */
export function RealClientLiveScreen({ siteId }: { siteId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const focused = useIsFocused();

  const appActive = useAppActive();
  const now = useNow(30_000, appActive);
  const { site, loadError } = usePolledSiteStatus(siteId);

  // Called unconditionally (before the early returns below) — it already handles a null `site`.
  const liveBand = useLiveGymBand(site, siteId, now);

  // The last two hours, in the gym's own time zone — each one's real band comes from the hourly history of its week
  // (the two hours can fall in different weeks right after midnight on a Monday).
  const timezone = site?.timezone ?? 'UTC';
  const recent = [2, 1].map((hoursAgo) => {
    const at = localTime(new Date(now - hoursAgo * 3600_000), timezone);
    return { at, hour: Math.floor(at.minutes / 60), weekStart: addDays(at.dateKey, -weekdayOfDateKey(at.dateKey)) };
  });
  const recentKey = recent.map((r) => `${r.at.dateKey}:${r.hour}`).join('|');
  const recentBands = useAsync(
    () => Promise.all([...new Set(recent.map((r) => r.weekStart))].map((w) => getWeekRealBands(siteId, w))).then((weeks) => weeks.flat()),
    [siteId, recentKey],
    site !== null
  );

  const subscription = useAsync(() => getMySubscription(), [focused], focused);
  const announcements = useAsync(() => getAnnouncements(), [focused], focused);

  if (loadError) {
    return (
      <Screen>
        <Banner title={t('manager.gym.error')} />
      </Screen>
    );
  }
  if (!site) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }

  const open = isGymOpenNow(site, now);
  // `liveBand` is `null` both while closed AND for the instant a just-opened gym's first poll is
  // still in flight — `loadingBand` tells those two apart so a brief fetch never reads as "closed".
  const loadingBand = open && liveBand === null;
  const band = open ? liveBand : null;

  // Was the gym open then, and what state was it in? (Closed hours have no band; a missing hour says so.)
  const recentHours: RecentHour[] | null =
    recentBands.data === undefined
      ? null
      : recent.map((r) => {
          const wasOpen = windowsOf(site.openingHours, r.at.weekday).some((w) => r.at.minutes >= w.start && r.at.minutes < w.end);
          const found = recentBands.data?.find((b) => b.dateKey === r.at.dateKey && b.hour === r.hour)?.band;
          const state: PastState = !wasOpen ? { kind: 'closed' } : found ? { kind: 'band', band: found } : { kind: 'noData' };
          return { label: `${String(r.hour).padStart(2, '0')}:00`, state };
        });

  return (
    <Screen orb={band ? { color: theme.band[band].solid, top: 40, size: 380 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LogoMark size={30} bgColor={theme.background} bandColor={band ? theme.band[band].solid : theme.textMuted} />
        <AppText variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontSize: 26, lineHeight: 30, letterSpacing: 26 * -0.05 }}>
          {site.name}
        </AppText>
        <View style={{ marginLeft: 'auto' }}>
          <ClientNotifications />
        </View>
      </View>

      <AnnouncementsStrip announcements={announcements.data ?? []} />

      {loadingBand ? <ActivityIndicator style={{ marginVertical: spacing.xxl }} /> : <GymBandHero band={band} />}

      <PaymentDueBanner />
      <ResolvedIssueBanner />

      <View style={{ gap: spacing.lg }}>
        {recentHours ? <RecentHoursCard hours={recentHours} nowBand={band} /> : null}
        <ClientPlanCard state={subscription.data} />
        <GymHoursCard site={site} nowMs={now} />
      </View>

      <WeeklyGoalPopup />
    </Screen>
  );
}

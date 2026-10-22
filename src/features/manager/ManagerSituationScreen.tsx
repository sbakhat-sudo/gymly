import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { GymBandHero } from '@/components/GymBandHero';
import { LogoMark } from '@/components/Logo';
import { Orb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { bandFromRatio } from '@/lib/domain/band';
import { localTime, zonedTimeToUtc } from '@/lib/domain/time';
import { isGymOpenNow, useLiveGymBand, usePolledSiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { usePageHeaderNode } from '@/lib/page-header-context';
import { spacing, useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { getPresentPeople, getRecentActivity, type ActivityEvent, type PresentPerson } from './manager-api';
import { ManagerNotifications } from './ManagerNotifications';
import { PresenceList } from './PresenceList';
import { ActivityFeed, SituationStatCards } from './SituationStats';

const PRESENCE_POLL_MS = 20_000;
const ACTIVITY_POLL_MS = 30_000;

/**
 * Page 1 — "La situazione": the same live-band hero as the member app's Live tab (`GymBandHero`),
 * now the real band — polled from the real count of open client check-ins (`useLiveGymBand`), not
 * a simulated curve. Below it, everyone with an open check-in right now.
 */
export function ManagerSituationScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const isWide = useSidebarMode();

  const appActive = useAppActive();
  const now = useNow(30_000, appActive);
  const { site, loadError } = usePolledSiteStatus(siteId);

  // Called unconditionally (before the early returns below) — it already handles a null `site`.
  const liveBand = useLiveGymBand(site, siteId, now);
  // This screen's own header is the gym's live logo + name, not a generic icon+title — registered
  // as a custom node (`usePageHeaderNode`, not the usual `usePageHeader`) so sidebar mode's fixed
  // `RoleTopBar` shows the *same* header instead of a redundant generic "Situazione" label next to
  // it. Duplicates the (cheap, pure) open/band check below rather than reordering it, since this
  // has to run before the early returns and that one can't (it needs the non-null `site` they
  // guard against).
  const headerBand = site && isGymOpenNow(site, now) ? liveBand : null;
  // `useTheme()` returns a brand-new object every render (not memoized) — depending on `theme`
  // itself here would make this `useMemo` recompute (and `usePageHeaderNode` re-register) on every
  // render, which previously produced a genuine infinite loop (see that hook's own note on why).
  // The specific colour *strings* below are stable across renders — same palette, just read fresh
  // each time — so depending on those instead is what actually makes the memo hold.
  const headerBgColor = theme.background;
  const headerBandColor = headerBand ? theme.band[headerBand].solid : theme.textMuted;
  const headerNode = useMemo(
    () =>
      site ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogoMark size={50} bgColor={headerBgColor} bandColor={headerBandColor} />
          <AppText variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
            {site.name}
          </AppText>
        </View>
      ) : null,
    [site, headerBgColor, headerBandColor]
  );
  usePageHeaderNode(headerNode);

  // Shared by `PresenceList` and the "In palestra ora"/"Occupazione" stat cards, so the two numbers
  // can never briefly disagree the way two independent polls of the same table could.
  const [people, setPeople] = useState<PresentPerson[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    const load = (): void => {
      getPresentPeople(siteId).then(
        (p) => alive && setPeople(p),
        () => alive && setPeopleError(true)
      );
    };
    load();
    const timer = setInterval(load, PRESENCE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId]);

  // Only re-triggers when the calendar day actually rolls over (or the site/timezone changes) —
  // depending on `site` itself would reset this on every 20s site-status poll, since that object is
  // a fresh reference each time even when nothing in it changed.
  const siteTimezone = site?.timezone ?? null;
  const todayDateKey = siteTimezone ? localTime(new Date(now), siteTimezone).dateKey : null;

  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [activityError, setActivityError] = useState(false);
  useEffect(() => {
    if (!siteId || !siteTimezone || !todayDateKey) return;
    let alive = true;
    const todayStartIso = zonedTimeToUtc(todayDateKey, 0, siteTimezone).toISOString();
    const load = (): void => {
      getRecentActivity(siteId, todayStartIso).then(
        (a) => alive && setActivity(a),
        () => alive && setActivityError(true)
      );
    };
    load();
    const timer = setInterval(load, ACTIVITY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId, siteTimezone, todayDateKey]);

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

  // Both "In palestra ora" and "Occupazione" are clients only — coaches never count toward the band
  // anywhere else in this app, so they don't count toward either of these stat cards either (the
  // presence LIST below still shows both, with its own role tag per row — only these two summary
  // numbers are client-only).
  const presentClientCount = people ? people.filter((p) => p.kind === 'client').length : null;
  const occupancyRatio = presentClientCount !== null ? presentClientCount / site.capacityReference : null;
  const occupancyPct = open && occupancyRatio !== null ? Math.round(occupancyRatio * 100) : null;
  // The stat card's own band/colour, derived from this exact same ratio and this site's own
  // configured thresholds (`site.bandGreenPct`/`bandAmberPct`, percentages — see "Gestione
  // Capienza") — NOT the separately-polled `band` above (`get_live_band`, its own 20s cycle). Two
  // independently-polled numbers driving one card could show a percentage and a band/colour that
  // briefly don't agree, which reads as "this card is stuck" even when both are individually
  // correct; deriving the label from the same number it's labelling can never disagree with itself.
  const occupancyBand = open && occupancyRatio !== null ? bandFromRatio(occupancyRatio, { green: site.bandGreenPct / 100, red: site.bandAmberPct / 100 }) : null;

  // The page-level `orb` glow centres itself across the whole scroll column — correct when the
  // hero is the only thing in that column (narrow/stacked), but wrong once wide mode moves the
  // hero into its own 360px-wide left column: it would float centred across the *full* wide row
  // instead, landing behind nothing. Wide mode scopes its own Orb to that column instead.
  return (
    <Screen orb={!isWide && band ? { color: theme.band[band].solid, top: 40, size: 380 } : undefined}>
      {!isWide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <LogoMark size={50} bgColor={theme.background} bandColor={band ? theme.band[band].solid : theme.textMuted} />
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
              {site.name}
            </AppText>
          </View>
          <ManagerNotifications />
        </View>
      ) : null}

      {site.notifyOnThreshold && band === 'red' ? <Banner title={t('manager.situation.full.banner')} /> : null}

      {isWide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
          <View style={{ width: 360, position: 'relative' }}>
            {band ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: 0, right: 0, height: 380, alignItems: 'center' }}>
                <Orb color={theme.band[band].solid} size={380} />
              </View>
            ) : null}
            {loadingBand ? <ActivityIndicator style={{ marginVertical: spacing.xxl }} /> : <GymBandHero band={band} />}
          </View>
          <View style={{ flex: 1.1, minWidth: 0, paddingTop: spacing.lg }}>
            {siteId ? <PresenceList siteId={siteId} people={people} error={peopleError} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: spacing.lg, paddingTop: spacing.lg }}>
            <SituationStatCards occupancyPct={occupancyPct} presentCount={presentClientCount} band={occupancyBand} />
            <ActivityFeed events={activity} error={activityError} lang={lang} />
          </View>
        </View>
      ) : (
        <>
          {loadingBand ? <ActivityIndicator style={{ marginVertical: spacing.xxl }} /> : <GymBandHero band={band} />}
          {siteId ? <PresenceList siteId={siteId} people={people} error={peopleError} /> : null}
          <SituationStatCards occupancyPct={occupancyPct} presentCount={presentClientCount} band={occupancyBand} />
          <ActivityFeed events={activity} error={activityError} lang={lang} />
        </>
      )}
    </Screen>
  );
}

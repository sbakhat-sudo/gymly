import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { GymBandHero } from '@/components/GymBandHero';
import { LogoMark } from '@/components/Logo';
import { Orb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { isGymOpenNow, useLiveGymBand, usePolledSiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { PresenceList } from './PresenceList';

/**
 * Page 1 — "La situazione": the same live-band hero as the member app's Live tab (`GymBandHero`),
 * now the real band — polled from the real count of open client check-ins (`useLiveGymBand`), not
 * a simulated curve. Below it, everyone with an open check-in right now.
 */
export function ManagerSituationScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const isWide = useSidebarMode();

  const appActive = useAppActive();
  const now = useNow(30_000, appActive);
  const { site, loadError } = usePolledSiteStatus(siteId);

  // Called unconditionally (before the early returns below) — it already handles a null `site`.
  const liveBand = useLiveGymBand(site, siteId, now);

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

  // The page-level `orb` glow centres itself across the whole scroll column — correct when the
  // hero is the only thing in that column (narrow/stacked), but wrong once wide mode moves the
  // hero into its own 360px-wide left column: it would float centred across the *full* wide row
  // instead, landing behind nothing. Wide mode scopes its own Orb to that column instead.
  return (
    <Screen orb={!isWide && band ? { color: theme.band[band].solid, top: 40, size: 380 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LogoMark size={38} bgColor={theme.background} bandColor={band ? theme.band[band].solid : theme.textMuted} />
        <AppText accessibilityRole="header" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', flexShrink: 1 }}>
          {site.name}
        </AppText>
      </View>

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
          <View style={{ flex: 1, minWidth: 0, maxWidth: 480, paddingTop: spacing.lg }}>{siteId ? <PresenceList siteId={siteId} /> : null}</View>
        </View>
      ) : (
        <>
          {loadingBand ? <ActivityIndicator style={{ marginVertical: spacing.xxl }} /> : <GymBandHero band={band} />}
          {siteId ? <PresenceList siteId={siteId} /> : null}
        </>
      )}
    </Screen>
  );
}

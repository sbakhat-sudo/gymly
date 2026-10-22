import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { GymBandHero } from '@/components/GymBandHero';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { PaymentDueBanner } from '@/features/billing/PaymentDueBanner';
import { ClientNotifications } from '@/features/checkin/ClientNotifications';
import { isGymOpenNow, useLiveGymBand, usePolledSiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';

import { ResolvedIssueBanner } from './ResolvedIssueBanner';
import { WeeklyGoalPopup } from './WeeklyGoalPopup';

/**
 * A real (approved) Client's Live tab — the same `GymBandHero` as the Manager's "Situazione" and
 * the guest/mock Live tab, now the real band polled from the member's own gym's open check-ins
 * (`useLiveGymBand`), not a simulated curve. Exported so `(client)/index.tsx` can branch on it.
 */
export function RealClientLiveScreen({ siteId }: { siteId: string }) {
  const theme = useTheme();
  const { t } = useI18n();

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

  return (
    <Screen orb={band ? { color: theme.band[band].solid, top: 40, size: 380 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LogoMark size={38} bgColor={theme.background} bandColor={band ? theme.band[band].solid : theme.textMuted} />
        <AppText variant="display" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontSize: 36, lineHeight: 41, letterSpacing: 36 * -0.05 }}>
          {site.name}
        </AppText>
        <View style={{ marginLeft: 'auto' }}>
          <ClientNotifications />
        </View>
      </View>

      {loadingBand ? <ActivityIndicator style={{ marginVertical: spacing.xxl }} /> : <GymBandHero band={band} />}

      <PaymentDueBanner />
      <ResolvedIssueBanner />
      <WeeklyGoalPopup />
    </Screen>
  );
}

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChevronRightIcon } from '@/components/icons';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Orb } from '@/components/Orb';
import { useLiveBand } from '@/features/home/use-live-band';
import { decorativeA11yProps } from '@/lib/a11y';
import { useAppState } from '@/lib/app-state';
import { useI18n } from '@/lib/i18n';
import { useCurrentSite } from '@/lib/sites-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import type { SiteSummary } from '@/schemas';

/**
 * Wraps a tab: shows the gym picker until a gym is chosen (first launch = "open → pick gym → see band"),
 * then renders the tab for that gym. No registration, no permissions, no onboarding.
 */
export function GymGate({ children }: { children: (site: SiteSummary) => ReactNode }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { setSiteId } = useAppState();
  const current = useCurrentSite();

  if (current.site) return <>{children(current.site)}</>;
  if (current.data === undefined) {
    if (current.error) {
      return (
        <View style={{ gap: spacing.lg }}>
          <Banner title={t('home.loadError')} />
          <Button label={t('common.retry')} onPress={current.reload} />
        </View>
      );
    }
    return <ActivityIndicator accessibilityLabel={t('state.loading')} style={{ marginTop: spacing.xxl }} />;
  }

  return (
    <View style={{ gap: 28, paddingTop: 40, paddingHorizontal: 6 }}>
      <View {...decorativeA11yProps} style={{ pointerEvents: 'none', position: 'absolute', top: -144, left: -30, right: -30, alignItems: 'center' }}>
        <Orb color={theme.band.green.solid} size={420} />
      </View>

      <View style={{ alignItems: 'center', gap: 14, paddingTop: 30 }} accessible accessibilityRole="image" accessibilityLabel="Gymly">
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 24,
            backgroundColor: theme.glassTint,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <LogoMark size={56} bgColor={theme.background} />
        </View>
        <Wordmark size={30} />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <AppText variant="headline" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 31 }}>
          {t('home.pickGym.title')}
        </AppText>
        <AppText muted style={{ fontSize: 15 }}>
          {t('home.pickGym.subtitle')}
        </AppText>
      </View>

      <View style={{ gap: 10 }}>
        {current.data.map((site) => (
          <GymRow key={site.site_id} site={site} onPress={() => setSiteId(site.site_id)} />
        ))}
      </View>
    </View>
  );
}

function GymRow({ site, onPress }: { site: SiteSummary; onPress: () => void }) {
  const { t, band: bandLabel } = useI18n();
  const theme = useTheme();
  const band = useLiveBand(site);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.pickGym.a11y', { name: site.name })}
      accessibilityHint={band ? bandLabel(band) : undefined}
      style={({ pressed }) => ({
        minHeight: MIN_TAP + 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: spacing.lg,
        borderRadius: radius.card,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        opacity: pressed ? 0.8 : 1,
      })}>
      {/* Shape + colour of the live band (never colour alone); a neutral tile when it is not known live. */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: band ? theme.band[band].soft : theme.surfaceAlt,
        }}>
        {band ? (
          <BandIcon band={band} size={16} color={theme.band[band].solid} />
        ) : (
          <LogoMark size={24} color={theme.textMuted} bgColor={theme.surfaceAlt} bandColor={theme.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText style={{ fontWeight: '600' }}>{site.name}</AppText>
        {site.address ? (
          <AppText muted style={{ fontSize: 12, lineHeight: 16 }}>
            {site.address}
          </AppText>
        ) : null}
      </View>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

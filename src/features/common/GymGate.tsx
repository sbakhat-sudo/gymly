import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChevronRightIcon } from '@/components/icons';
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
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('home.pickGym.title')}
        </AppText>
        <AppText muted>{t('home.pickGym.subtitle')}</AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        {current.data.map((site) => (
          <GymRow key={site.site_id} site={site} onPress={() => setSiteId(site.site_id)} />
        ))}
      </View>
    </View>
  );
}

function GymRow({ site, onPress }: { site: SiteSummary; onPress: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.pickGym.a11y', { name: site.name })}
      style={({ pressed }) => ({
        minHeight: MIN_TAP + 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title">{site.name}</AppText>
        {site.address ? (
          <AppText muted variant="caption">
            {site.address}
          </AppText>
        ) : null}
      </View>
      <ChevronRightIcon color={theme.textMuted} />
    </Pressable>
  );
}

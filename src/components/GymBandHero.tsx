import { View } from 'react-native';

import { LiveGauge } from '@/features/home/LiveGauge';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { AppText } from './AppText';
import { Card } from './Card';
import { LiveDot } from './LiveDot';

const HERO_HEIGHT = 330;
const GAUGE_SIZE = 290;

/**
 * The live-band hero, shared by the member app's Live tab (`HomeHero`, mock-backed) and every
 * real-Supabase-backed band display (Manager's "Situazione", a real Client's Live tab): same
 * LiveGauge + LIVE chip + big band label, so "same design" holds regardless of the data source.
 * `null` band reads as closed — a dashed card, never a fabricated reading.
 */
export function GymBandHero({ band }: { band: Band | null }) {
  const { t, band: bandLabel } = useI18n();
  const theme = useTheme();

  if (!band) {
    return (
      <Card dashed style={{ marginVertical: spacing.xl, alignItems: 'center', paddingVertical: spacing.xxl }}>
        <AppText variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('state.closed')}
        </AppText>
      </Card>
    );
  }

  return (
    <View style={{ height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: -14 }}>
        <LiveGauge band={band} size={GAUGE_SIZE} />
      </View>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${bandLabel(band)}. ${t(`band.${band}.hint`)}`}
        style={{ alignItems: 'center', gap: spacing.sm, marginTop: -24 }}>
        <View
          accessibilityLabel={t('home.live.a11y')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: radius.pill,
            backgroundColor: theme.chip,
          }}>
          <LiveDot color={theme.band[band].solid} />
          <AppText style={{ fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 14, letterSpacing: 11 * 0.12 }}>{t('home.live')}</AppText>
        </View>
        <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ textAlign: 'center', maxWidth: 250 }}>
          {bandLabel(band)}
        </AppText>
        <AppText color={theme.textSoft} style={{ fontSize: 15, lineHeight: 20, maxWidth: 190, textAlign: 'center' }}>
          {t(`band.${band}.hint`)}
        </AppText>
      </View>
    </View>
  );
}

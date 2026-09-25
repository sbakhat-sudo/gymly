import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandBadge } from '@/components/BandBadge';
import { BandIcon } from '@/components/BandIcon';
import { Card } from '@/components/Card';
import type { HomeState } from '@/lib/domain/home-state';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

export type HeroView =
  | { kind: 'loading' }
  | { kind: 'closed'; reopens: string | null }
  | { kind: 'data'; state: HomeState; forecastBand: Band | undefined; offlineNoData: boolean };

/**
 * The hero of the Home screen. Exactly one of these is ever shown, chosen by `resolveHomeState`:
 *   live        solid band card (label + shape), "~" when approximate
 *   stale       dashed neutral card, last band dimmed and explicitly labelled
 *   forecast    dashed neutral card, band hidden, forecast shown and labelled "previsione"
 *   unavailable dashed neutral card "Dato non disponibile" + forecast
 */
export function HomeHero({ view }: { view: HeroView }) {
  const { t, band: bandLabel, duration } = useI18n();
  const theme = useTheme();

  if (view.kind === 'loading') {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ActivityIndicator color={theme.primary} />
          <AppText muted>{t('state.loading')}</AppText>
        </View>
      </Card>
    );
  }

  if (view.kind === 'closed') {
    return (
      <Card>
        <AppText variant="headline" accessibilityRole="header">
          {t('state.closed')}
        </AppText>
        {view.reopens ? <AppText muted>{t('state.opensAt', { when: view.reopens })}</AppText> : null}
      </Card>
    );
  }

  const { state, forecastBand, offlineNoData } = view;

  if (state.mode === 'live') {
    const colors = theme.band[state.band];
    const label = `${state.approximate ? '~' : ''}${bandLabel(state.band)}`;
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${label}. ${t(`band.${state.band}.hint`)}`}
        style={{
          backgroundColor: colors.solid,
          borderRadius: radius.lg,
          padding: spacing.xl,
          paddingVertical: spacing.xxl,
          gap: spacing.md,
          alignItems: 'center',
        }}>
        <BandIcon band={state.band} size={72} color={colors.onSolid} />
        <AppText variant="display" color={colors.onSolid} style={{ textAlign: 'center' }}>
          {label}
        </AppText>
        <AppText color={colors.onSolid} style={{ textAlign: 'center' }}>
          {t(`band.${state.band}.hint`)}
        </AppText>
        {state.approximate ? (
          <AppText variant="caption" color={colors.onSolid} style={{ fontWeight: '600' }}>
            {t('state.approx')}
          </AppText>
        ) : null}
      </View>
    );
  }

  if (state.mode === 'stale') {
    return (
      <Card dashed style={{ opacity: 0.92 }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('state.stale')}
        </AppText>
        <AppText muted>{t('state.staleDetail', { ago: duration(state.ageS) })}</AppText>
        <BandBadge band={state.band} forecast prefix={t('state.staleBand')} />
        <ForecastNow band={forecastBand} />
      </Card>
    );
  }

  // forecast (low confidence) / unavailable
  const title = state.mode === 'forecast' ? t('state.lowConfidence') : t('state.unavailable');
  const detail =
    state.mode === 'forecast'
      ? t('state.lowConfidenceDetail')
      : offlineNoData
        ? t('state.unavailable.offline')
        : state.reason === 'adapter'
          ? t('state.unavailable.adapter')
          : state.reason === 'too-old'
            ? t('state.unavailable.tooOld')
            : t('state.unavailable.invalid');
  return (
    <Card dashed>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      <AppText muted>{detail}</AppText>
      <ForecastNow band={forecastBand} />
    </Card>
  );
}

/** Forecast for the current slot: always dashed and prefixed, so it can never pass for a live reading. */
function ForecastNow({ band }: { band: Band | undefined }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" muted style={{ fontWeight: '600' }}>
        {t('state.forecastNow')}
      </AppText>
      {band ? <BandBadge band={band} forecast prefix={`${t('state.forecast')}:`} /> : <AppText muted>{t('state.forecastUnknown')}</AppText>}
    </View>
  );
}

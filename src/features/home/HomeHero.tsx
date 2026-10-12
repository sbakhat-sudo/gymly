import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandBadge } from '@/components/BandBadge';
import { Card } from '@/components/Card';
import { LiveDot } from '@/components/LiveDot';
import type { HomeState } from '@/lib/domain/home-state';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { LiveGauge } from './LiveGauge';

export type HeroView =
  | { kind: 'loading' }
  | { kind: 'closed'; reopens: string | null }
  | { kind: 'data'; state: HomeState; forecastBand: Band | undefined; offlineNoData: boolean };

const HERO_HEIGHT = 330;
const GAUGE_SIZE = 290;

/**
 * The hero of the Live screen. Exactly one of these is ever shown, chosen by `resolveHomeState`:
 *   live        the band dial: LIVE chip, big band label (+ shape via the dial level), "~" when approximate
 *   stale       dashed card, last band dimmed and explicitly labelled
 *   forecast    dashed card, band hidden, forecast shown and labelled "previsione"
 *   unavailable dashed card "Dato non disponibile" + forecast
 * `meta` ("aggiornato … · accuratezza …") sits at the bottom of the live dial.
 */
export function HomeHero({ view, meta }: { view: HeroView; meta: string | null }) {
  const { t, band: bandLabel, duration } = useI18n();
  const theme = useTheme();

  if (view.kind === 'loading') {
    return (
      <View style={{ height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <ActivityIndicator color={theme.text} />
        <AppText muted>{t('state.loading')}</AppText>
      </View>
    );
  }

  if (view.kind === 'closed') {
    return (
      <Card dashed style={{ marginVertical: spacing.xl, alignItems: 'center', paddingVertical: spacing.xxl }}>
        <AppText variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('state.closed')}
        </AppText>
        {view.reopens ? (
          <AppText muted style={{ textAlign: 'center' }}>
            {t('state.opensAt', { when: view.reopens })}
          </AppText>
        ) : null}
      </Card>
    );
  }

  const { state, forecastBand, offlineNoData } = view;

  if (state.mode === 'live') {
    const label = `${state.approximate ? '~' : ''}${bandLabel(state.band)}`;
    return (
      <View style={{ height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: -14 }}>
          <LiveGauge band={state.band} size={GAUGE_SIZE} />
        </View>
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${label}. ${t(`band.${state.band}.hint`)}`}
          style={{ alignItems: 'center', gap: spacing.sm, marginTop: -24 }}>
          {!state.offline ? (
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
              <LiveDot color={theme.band[state.band].solid} />
              <AppText style={{ fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 14, letterSpacing: 11 * 0.12 }}>
                {t('home.live')}
              </AppText>
            </View>
          ) : null}
          <AppText
            variant="display"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ textAlign: 'center', maxWidth: 250 }}>
            {label}
          </AppText>
          <AppText color={theme.textSoft} style={{ fontSize: 15, lineHeight: 20, maxWidth: 190, textAlign: 'center' }}>
            {t(`band.${state.band}.hint`)}
          </AppText>
          {state.approximate ? (
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: theme.chip }}>
              <AppText variant="caption" style={{ fontWeight: '700' }}>
                {t('state.approx')}
              </AppText>
            </View>
          ) : null}
        </View>
        {meta ? (
          <AppText
            muted
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ position: 'absolute', bottom: 4, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>
            {meta}
          </AppText>
        ) : null}
      </View>
    );
  }

  if (state.mode === 'stale') {
    return (
      <Card dashed style={{ opacity: 0.92, marginTop: spacing.md }}>
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
    <Card dashed style={{ marginTop: spacing.md }}>
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
      <AppText variant="caption" muted style={{ fontWeight: '700' }}>
        {t('state.forecastNow')}
      </AppText>
      {band ? <BandBadge band={band} forecast prefix={`${t('state.forecast')}:`} /> : <AppText muted>{t('state.forecastUnknown')}</AppText>}
    </View>
  );
}

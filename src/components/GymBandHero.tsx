import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { LiveGauge } from '@/features/home/LiveGauge';
import { decorativeA11yProps } from '@/lib/a11y';
import { todayOpening } from '@/lib/domain/client-home';
import { formatTime, localTime } from '@/lib/domain/time';
import type { SiteStatus } from '@/lib/gym-status';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { AppText } from './AppText';
import { MoonIcon } from './icons';
import { LiveDot } from './LiveDot';

const HERO_HEIGHT = 330;
const GAUGE_SIZE = 290;

/** The live dial with every tick switched off and a thin lit start, so a closed gym reads as "resting", not "broken". Decorative. */
function SleepingDial({ size }: { size: number }) {
  const theme = useTheme();
  const TICKS = 64;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = ((135 + (270 * i) / (TICKS - 1)) * Math.PI) / 180;
    return { x1: 150 + 132 * Math.cos(a), y1: 150 + 132 * Math.sin(a), x2: 150 + 142 * Math.cos(a), y2: 150 + 142 * Math.sin(a) };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300" {...decorativeA11yProps}>
      {ticks.map((k, i) => (
        <Line key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} stroke={theme.tickOff} strokeWidth={3.2} strokeLinecap="round" opacity={0.55} />
      ))}
    </Svg>
  );
}

/**
 * The live-band hero, shared by the member app's Live tab (`HomeHero`, mock-backed) and every
 * real-Supabase-backed band display (Manager's "Situazione", a real Client's Live tab): same
 * LiveGauge + LIVE chip + big band label, so "same design" holds regardless of the data source.
 * `null` band reads as closed — a resting dial with the moon and the reopening time, never a fabricated reading.
 */
export function GymBandHero({ band, site, now }: { band: Band | null; site?: Pick<SiteStatus, 'openingHours' | 'timezone'>; now?: number }) {
  const { t, lang, band: bandLabel } = useI18n();
  const theme = useTheme();

  if (!band) {
    // Closed: the same dial, switched off, with the moon and — from the gym's own opening hours — when it reopens.
    let reopens: string | null = null;
    if (site && now !== undefined) {
      const local = localTime(new Date(now), site.timezone);
      const opening = todayOpening(site.openingHours, local.weekday, local.minutes);
      if (opening.kind === 'opensLater') {
        reopens = t('home.closed.opensToday', { time: formatTime(opening.opensAt) });
      } else if (opening.kind === 'closedForToday' && opening.next) {
        const { weekday, opensAt } = opening.next;
        reopens =
          weekday === (local.weekday + 1) % 7
            ? t('home.closed.opensTomorrow', { time: formatTime(opensAt) })
            : t('home.closed.opensOn', { day: new Date(2024, 0, 1 + weekday).toLocaleDateString(lang, { weekday: 'long' }), time: formatTime(opensAt) });
      }
    }
    return (
      <View style={{ height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: -14 }}>
          <SleepingDial size={GAUGE_SIZE} />
        </View>
        <View accessible accessibilityRole="summary" accessibilityLabel={`${t('state.closed')}. ${reopens ?? ''}`} style={{ alignItems: 'center', gap: spacing.sm, marginTop: -24 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.chip,
              borderWidth: 1,
              borderColor: theme.glassBorder,
            }}>
            <MoonIcon color={theme.textSoft} size={26} />
          </View>
          <AppText variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ textAlign: 'center', maxWidth: 250 }}>
            {t('state.closed')}
          </AppText>
          {reopens ? (
            <View style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: theme.chip }}>
              <AppText color={theme.textSoft} style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', textAlign: 'center' }}>
                {reopens}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
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

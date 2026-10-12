import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { hourlyBands, hourlyLoad } from '@/lib/domain/heatmap';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, useTheme } from '@/lib/theme';
import type { Forecast } from '@/schemas';

// Covers "now" plus roughly a typical visit: a member who checks in stays about 90 minutes, so this
// shows one bar short of the two full hours after now — enough to tell "will it still be free when
// I'm done", not a whole afternoon of hours that don't matter to this visit.
const HOURS_SHOWN = 3;
const BAR_MIN = 22;
const BAR_RANGE = 52;

/**
 * "Prossime ore" on the Live screen: one pill per hour, coloured by the forecast band and as tall as
 * the forecast load — so the level reads from the height too, never from colour alone. Each pill is
 * labelled for screen readers ("16:00: Libera"). Closed hours are an empty dashed outline.
 */
export function UpcomingStrip({ forecast, currentHour }: { forecast: Forecast; currentHour: number }) {
  const theme = useTheme();
  const { t, band: bandLabel } = useI18n();
  const bands = hourlyBands(forecast.buckets);
  const load = hourlyLoad(forecast.buckets);
  const hours = Array.from({ length: HOURS_SHOWN }, (_, i) => currentHour + i).filter((h) => h < 24);

  if (hours.every((h) => (bands[h] ?? null) === null)) return null;

  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: 96 }}>
      {hours.map((h, i) => {
        const band = bands[h] ?? null;
        const time = `${String(h).padStart(2, '0')}:00`;
        const solid = band ? theme.band[band].solid : null;
        const glow: ViewStyle =
          solid && Platform.OS === 'web' ? ({ boxShadow: `0 0 18px -2px ${solid}` } as ViewStyle) : {};
        return (
          <View key={h} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
            <View
              accessible
              accessibilityLabel={
                band ? t('home.upcoming.cellA11y', { time, band: bandLabel(band) }) : t('schedule.cellClosedA11y', { day: t('time.today'), hour: time })
              }
              style={[
                {
                  width: '100%',
                  height: solid ? Math.round(BAR_MIN + (load[h] ?? 0) * BAR_RANGE) : BAR_MIN,
                  borderRadius: radius.pill,
                  backgroundColor: solid ?? 'transparent',
                  borderWidth: solid ? 0 : 1,
                  borderStyle: 'dashed',
                  borderColor: theme.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: 7,
                },
                glow,
              ]}>
              {/* The band's shape at the foot of the bar: the level never depends on colour alone. */}
              {band ? <BandIcon band={band} size={8} color={theme.band[band].onSolid} /> : null}
            </View>
            <AppText
              {...decorativeA11yProps}
              color={i === 0 ? theme.text : theme.textMuted}
              style={{ fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 14 }}>
              {i === 0 ? t('home.upcoming.now') : String(h).padStart(2, '0')}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { decorativeA11yProps } from '@/lib/a11y';
import { BAND_ORDER } from '@/lib/domain/band';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';

/** Band key under the day's chart (Aurora): three equal soft pills, each with the band's shape and label. */
export function ScheduleLegend() {
  const { band: bandLabel } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {BAND_ORDER.map((band) => {
        const colors = theme.band[band];
        return (
          <View
            key={band}
            style={{
              flex: 1,
              height: 34,
              borderRadius: radius.pill,
              backgroundColor: colors.soft,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <View {...decorativeA11yProps}>
              <BandIcon band={band} size={10} color={colors.solid} />
            </View>
            <AppText color={colors.onSoft} numberOfLines={1} style={{ fontSize: 12, fontWeight: '600' }}>
              {bandLabel(band)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

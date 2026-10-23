import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

/** A band as a small pill: its own shape + its word (Libera / Moderata / Affollata) on the band's soft colour —
 * so the level never rests on colour alone. */
export function BandChip({ band, size = 'md' }: { band: Band; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const theme = useTheme();
  const colors = theme.band[band];
  const small = size === 'sm';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: small ? 4 : 6,
        alignSelf: 'flex-start',
        paddingVertical: small ? 3 : 5,
        paddingHorizontal: small ? 8 : 10,
        borderRadius: radius.pill,
        backgroundColor: colors.soft,
      }}>
      <BandIcon band={band} size={small ? 12 : 15} color={colors.onSoft} />
      <AppText style={{ color: colors.onSoft, fontWeight: '700', fontSize: small ? 11.5 : 13 }}>{t(`band.${band}`)}</AppText>
    </View>
  );
}

import { View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { AppText } from './AppText';
import { BandIcon } from './BandIcon';

interface BandBadgeProps {
  band: Band;
  /** Medium confidence: the label is prefixed with "~". */
  approximate?: boolean;
  /** Forecast badges are drawn dashed and neutral so they cannot be mistaken for a live reading. */
  forecast?: boolean;
  /** Optional text before the band label (e.g. "Previsione:"). */
  prefix?: string;
}

/** Icon + text label of a band. The pairing (never colour alone) is the accessibility contract. */
export function BandBadge({ band, approximate = false, forecast = false, prefix }: BandBadgeProps) {
  const theme = useTheme();
  const { band: bandLabel } = useI18n();
  const colors = theme.band[band];
  const label = `${prefix ? `${prefix} ` : ''}${approximate ? '~' : ''}${bandLabel(band)}`;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.sm,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: forecast ? theme.surface : colors.soft,
        borderWidth: forecast ? 1.5 : 0,
        borderStyle: 'dashed',
        borderColor: colors.onSoft,
      }}>
      <BandIcon band={band} size={18} color={colors.onSoft} />
      <AppText color={forecast ? theme.text : colors.onSoft} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

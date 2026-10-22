import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CalendarIcon, ClockIcon, LightbulbIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

interface RealBestMomentCardProps {
  /** null = no quiet moment found for today's pattern: the card says so instead of a time+percentage. */
  moment: { hour: number; pct: number } | null;
  emptyText: string;
}

/**
 * "Orario Migliore": today's historically quietest hour, with the REAL occupancy percentage for
 * this specific gym — `pct` comes from `get_weekly_stats` (check-ins ÷ the Manager's own
 * `capacity_reference`, see "Gestione Capienza"), never a static example number. Read-only (no
 * reminder button, unlike the forecast `BestMomentCard`): this is today's long-run historical
 * pattern, not a live countdown to a specific free window.
 */
export function RealBestMomentCard({ moment, emptyText }: RealBestMomentCardProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const time = moment ? `${String(moment.hour).padStart(2, '0')}:00` : null;

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface, flexDirection: 'row' }, CARD_SHADOW]}>
      <View
        style={{
          width: 44,
          height: 44,
          minWidth: 44,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.primary + '18',
        }}>
        <LightbulbIcon color={theme.primary} size={22} />
      </View>

      <View style={{ flex: 1, gap: spacing.sm }}>
        <View style={{ gap: 2 }}>
          <AppText accessibilityRole="header" style={{ fontSize: 18, lineHeight: 23, fontWeight: '800' }}>
            {moment && time ? t('schedule.topToday.title', { time }) : emptyText}
          </AppText>
          {moment ? (
            <AppText muted style={{ fontSize: 12.5 }}>
              {t('schedule.topToday.subtitle')}
            </AppText>
          ) : null}
        </View>

        {moment && time ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', gap: 3, paddingTop: 1 }}>
              <ClockIcon color={theme.textMuted} size={13} />
              <CalendarIcon color={theme.textMuted} size={13} />
            </View>
            <AppText muted style={{ flex: 1, fontSize: 11.5, lineHeight: 16, fontFamily: fontFamily.body }}>
              {t('schedule.topToday.explain', { time, pct: moment.pct })}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

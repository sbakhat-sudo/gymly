import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LogInIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import { BandChip } from './BandChip';

/** One of the Client's own past visits, with how busy the gym was in the hour they walked in. */
export interface MyVisit {
  id: number;
  dateKey: string;
  startMinutes: number;
  /** null while the visit is still open. */
  endMinutes: number | null;
  /** The band of the hour of arrival; null when that hour has no real data (older than the window we read). */
  band: Band | null;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * "I miei passaggi": the Client's last visits to the gym, newest first — the day, the time they were there,
 * and the state of the gym at that moment (Libera / Moderata / Affollata), taken from the real hourly data of
 * that very hour. Nothing here is a forecast or a guess; an hour with no real data says so.
 */
export function MyVisitsCard({ visits }: { visits: readonly MyVisit[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <LogInIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText accessibilityRole="header" style={{ fontSize: 18, lineHeight: 23, fontWeight: '800' }}>
            {t('schedule.visits.title')}
          </AppText>
          <AppText muted style={{ fontSize: 12.5 }}>
            {t('schedule.visits.subtitle')}
          </AppText>
        </View>
      </View>

      {visits.length === 0 ? (
        <AppText muted style={{ fontSize: 13.5 }}>
          {t('schedule.visits.empty')}
        </AppText>
      ) : (
        <View>
          {visits.map((v, i) => {
            const day = new Date(`${v.dateKey}T12:00:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
            const time = v.endMinutes === null ? `${clock(v.startMinutes)} · ${t('schedule.visits.inProgress')}` : `${clock(v.startMinutes)}–${clock(v.endMinutes)}`;
            return (
              <View
                key={v.id}
                accessible
                accessibilityLabel={`${day}, ${time}, ${v.band ? t(`band.${v.band}`) : t('schedule.visits.noData')}`}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm + 2, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                <View style={{ gap: 1, flexShrink: 1 }}>
                  <AppText style={{ fontWeight: '700', fontSize: 14.5, textTransform: 'capitalize' }}>{day}</AppText>
                  <AppText muted style={{ fontSize: 12.5 }}>
                    {time}
                  </AppText>
                </View>
                {v.band ? (
                  <BandChip band={v.band} size="sm" />
                ) : (
                  <AppText muted style={{ fontSize: 12 }}>
                    {t('schedule.visits.noData')}
                  </AppText>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

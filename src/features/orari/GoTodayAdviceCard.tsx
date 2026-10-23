import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LightbulbIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import type { HourAdvice } from '@/lib/domain/gym-advice';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import { BandChip } from './BandChip';

export interface GoAdvice {
  /** Today if there is still a good hour left, otherwise tomorrow. */
  day: 'today' | 'tomorrow';
  /** The weekday the advice is about, as a ready-to-read plural ("giovedì" / "Thursdays"). */
  weekdayLabel: string;
  best: HourAdvice;
  alternative: HourAdvice | null;
}

function clock(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * "Il consiglio per te": after analysing the real history of this weekday at this gym, the hour to go
 * today (the emptiest one still ahead — or tomorrow's, once today's open hours are over), with the reason
 * written out: how the gym usually is at that hour and how much it is used. Never invented: with too little
 * history the card says there isn't enough data yet instead of guessing an hour.
 */
export function GoTodayAdviceCard({ advice }: { advice: GoAdvice | null }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface, flexDirection: 'row' }, CARD_SHADOW]}>
      <View style={{ width: 44, height: 44, minWidth: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
        <LightbulbIcon color={theme.primary} size={22} />
      </View>

      <View style={{ flex: 1, gap: spacing.sm }}>
        <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {t('schedule.advice.header')}
        </AppText>

        {advice ? (
          <>
            <AppText accessibilityRole="header" style={{ fontSize: 22, lineHeight: 27, fontWeight: '800' }}>
              {t(advice.day === 'today' ? 'schedule.advice.title.today' : 'schedule.advice.title.tomorrow', { time: clock(advice.best.hour) })}
            </AppText>
            <BandChip band={advice.best.band} />
            <View style={{ gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
              <AppText muted style={{ fontSize: 12.5, lineHeight: 17 }}>
                {t('schedule.advice.why', { weekday: advice.weekdayLabel, time: clock(advice.best.hour), band: t(`band.${advice.best.band}`).toLowerCase(), pct: Math.round(advice.best.pct) })}
              </AppText>
              {advice.alternative ? (
                <AppText muted style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {t('schedule.advice.alt', { time: clock(advice.alternative.hour), pct: Math.round(advice.alternative.pct) })}
                </AppText>
              ) : null}
              <AppText color={theme.faint} style={{ fontSize: 11.5, lineHeight: 15 }}>
                {t('schedule.advice.basis', { weekday: advice.weekdayLabel })}
              </AppText>
            </View>
          </>
        ) : (
          <AppText style={{ fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{t('schedule.advice.empty')}</AppText>
        )}
      </View>
    </View>
  );
}

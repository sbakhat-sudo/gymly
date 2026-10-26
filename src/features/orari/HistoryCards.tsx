import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TrendingUpIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { formatHoursMinutes } from '@/lib/domain/checkin';
import type { WeekSummary } from '@/lib/domain/client-home';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

/** Three numbers at the top of Storico: time at the gym, visits per week on average, visits so far. */
export function HistoryStatsTiles({ seconds, weeklyAverage, visits, since }: { seconds: number; weeklyAverage: number | null; visits: number; since: Date | null }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';
  const tile = (label: string, value: string, unit: string | null) => (
    <View style={[{ flex: 1, minWidth: 0, borderRadius: radius.card, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', gap: 4, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <AppText muted style={{ fontSize: 12, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
        {label}
      </AppText>
      <AppText numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fontFamily.displaySemi, fontSize: 24, lineHeight: 30 }}>
        {value}
      </AppText>
      {unit ? (
        <AppText muted style={{ fontSize: 11.5, textAlign: 'center' }} numberOfLines={1}>
          {unit}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {tile(t('history.stats.total'), visits === 0 ? '—' : formatHoursMinutes(seconds), null)}
      {tile(t('history.stats.avg'), weeklyAverage === null ? '—' : weeklyAverage.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }), t('history.stats.avgUnit'))}
      {tile(t('history.stats.visits'), String(visits), since ? t('history.stats.since', { date: since.toLocaleDateString(locale, { month: 'short', year: 'numeric' }) }) : null)}
    </View>
  );
}

/**
 * "Confronto settimanale": this week against last week (visits and time, with the difference in words), then the
 * last weeks side by side as columns — so going 4 times one week and 3 the next shows up at a glance. The current
 * week is the filled column; every column carries its number, never colour alone.
 */
export function WeeklyProgressCard({ weeks }: { weeks: readonly WeekSummary[] }) {
  const { t } = useI18n();
  const theme = useTheme();
  const current = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  if (!current || !previous) return null;

  const diff = current.visits - previous.visits;
  const max = Math.max(1, ...weeks.map((w) => w.visits));
  const barMax = Math.max(1, current.visits, previous.visits);
  const dayMonth = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00`);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const summaryText = (w: WeekSummary): string => t(w.visits === 1 ? 'history.week.visits.one' : 'history.week.visits.other', { n: w.visits, time: formatHoursMinutes(w.seconds) });
  const diffText = diff === 0 ? t('history.week.same') : t(diff > 0 ? 'history.week.more' : 'history.week.less', { n: Math.abs(diff) });
  const diffColor = diff > 0 ? theme.band.green.solid : diff < 0 ? theme.band.amber.solid : theme.textMuted;

  const row = (label: string, w: WeekSummary, color: string) => (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
        <AppText style={{ fontWeight: '800', fontSize: 14.5 }}>{label}</AppText>
        <AppText style={{ fontWeight: '700', fontSize: 13, color }}>{summaryText(w)}</AppText>
      </View>
      <View style={{ height: 9, borderRadius: 5, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${(w.visits / barMax) * 100}%`, height: 9, borderRadius: 5, backgroundColor: color }} />
      </View>
    </View>
  );

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.lg, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <TrendingUpIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '800', fontSize: 18 }}>{t('history.week.title')}</AppText>
          <AppText muted style={{ fontSize: 13 }}>
            {t('history.week.subtitle')}
          </AppText>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        {row(t('history.week.this'), current, theme.primary)}
        {row(t('history.week.last'), previous, theme.textMuted)}
        <AppText style={{ fontWeight: '800', fontSize: 13.5, color: diffColor }}>{diffText}</AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {t('history.week.chartTitle')}
        </AppText>
        <View
          accessible
          accessibilityLabel={weeks.map((w) => `${dayMonth(w.weekStart)}: ${w.visits}`).join(', ')}
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {weeks.map((w, i) => {
            const isCurrent = i === weeks.length - 1;
            const h = w.visits === 0 ? 3 : 10 + (w.visits / max) * 74;
            return (
              <View key={w.weekStart} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <AppText style={{ fontSize: 12.5, fontWeight: '800', color: w.visits > 0 ? theme.text : theme.textMuted }}>{w.visits}</AppText>
                <View style={{ width: '100%', maxWidth: 34, height: h, borderRadius: 6, backgroundColor: isCurrent ? theme.primary : theme.textMuted, opacity: isCurrent ? 1 : 0.45 }} />
                <AppText style={{ fontSize: 10.5, fontWeight: isCurrent ? '800' : '500', color: isCurrent ? theme.primary : theme.textMuted }} numberOfLines={1}>
                  {dayMonth(w.weekStart)}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppText muted style={{ fontSize: 11.5, textAlign: 'center' }}>
          {t('history.week.chartHint')}
        </AppText>
      </View>
    </View>
  );
}

import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { BarChartIcon, CalendarIcon, ChevronRightIcon, ClockIcon, LayersIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { formatHoursMinutes } from '@/lib/domain/checkin';
import { formatClockTime, formatDayLabel } from '@/lib/format';
import { useI18n, type Lang } from '@/lib/i18n';
import { avatarTint } from '@/lib/avatar-tint';
import { radius, spacing, useTheme } from '@/lib/theme';

type IconType = (p: { color: string; size: number }) => ReactElement;

function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

function cardShell(theme: ReturnType<typeof useTheme>): object[] {
  return [{ flex: 1, minWidth: 0, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW];
}

/** Left card: who's checked in, since when, and where — the Coach's own identity card for this
 * screen, not a generic page title. `onViewProfile` goes to Impostazioni, the only place that
 * identity (photo, name) is actually edited. */
export function CoachProfileCard({
  fullName,
  avatarUrl,
  checkedIn,
  checkinAt,
  siteName,
  lang,
  onViewProfile,
}: {
  fullName: string;
  avatarUrl: string | null;
  checkedIn: boolean;
  checkinAt: string | null;
  siteName: string | null;
  lang: Lang;
  onViewProfile: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const statusColor = checkedIn ? theme.band.green.solid : theme.textMuted;

  return (
    <View style={cardShell(theme)}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar uri={avatarUrl} name={fullName} size={88} tint={avatarTint(theme, fullName)} />
        <AppText numberOfLines={1} style={{ fontWeight: '800', fontSize: 19 }}>
          {fullName}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
          <AppText color={statusColor} style={{ fontWeight: '700', fontSize: 13 }}>
            {t(checkedIn ? 'coach.presence.card.inGym' : 'coach.presence.card.notInGym')}
          </AppText>
        </View>
      </View>

      <Divider />

      {checkedIn && checkinAt ? (
        <>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <AppText variant="caption" muted>
              {t('coach.presence.card.checkinAt')}
            </AppText>
            <AppText style={{ fontWeight: '800', fontSize: 17 }}>
              {formatDayLabel(lang, checkinAt)} • {formatClockTime(lang, checkinAt)}
            </AppText>
          </View>
          <Divider />
        </>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ClockIcon color={theme.textMuted} size={15} />
        <AppText muted style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
          {t('coach.presence.card.site')}{' '}
          <AppText style={{ fontWeight: '700', color: theme.text }}>{siteName ?? t('common.unnamedPerson')}</AppText>
        </AppText>
      </View>

      <Pressable
        onPress={onViewProfile}
        accessibilityRole="button"
        accessibilityLabel={t('coach.presence.card.fullProfile')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: theme.surfaceAlt,
          opacity: pressed ? 0.75 : 1,
        })}>
        <ChevronRightIcon color={theme.text} size={15} />
        <AppText style={{ fontWeight: '700', fontSize: 13 }}>{t('coach.presence.card.fullProfile')}</AppText>
      </Pressable>
    </View>
  );
}

/** Right card: today's hours, this week's total, and the average week across the Coach's whole
 * history — same real `checkins` rows `CoachHoursScreen`'s register uses, just summarised instead
 * of listed row by row. */
export function CoachStatsCard({ todaySeconds, weekSeconds, weeklyAverageSeconds }: { todaySeconds: number; weekSeconds: number; weeklyAverageSeconds: number }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={cardShell(theme)}>
      <AppText style={{ fontWeight: '800', fontSize: 20 }}>{t('coach.presence.stats.title')}</AppText>
      <StatRow icon={LayersIcon} tint={theme.accent} label={t('coach.presence.stats.today')} value={formatHoursMinutes(todaySeconds)} />
      <Divider />
      <StatRow icon={CalendarIcon} tint={theme.primary} label={t('coach.presence.stats.thisWeek')} value={formatHoursMinutes(weekSeconds)} />
      <Divider />
      <StatRow icon={BarChartIcon} tint={theme.band.green.solid} label={t('coach.presence.stats.weeklyAverage')} value={formatHoursMinutes(weeklyAverageSeconds)} />
    </View>
  );
}

function StatRow({ icon: Icon, tint, label, value }: { icon: IconType; tint: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}22` }}>
        <Icon color={tint} size={17} />
      </View>
      <AppText muted numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
        {label}
      </AppText>
      <AppText numberOfLines={1} style={{ fontWeight: '800', fontSize: 19 }}>
        {value}
      </AppText>
    </View>
  );
}

import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ClockIcon } from '@/components/icons';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';

/** The length of the automatic payment window (see `owner_plans_lifecycle()`): the bar fills as it runs out. */
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The Owner's "your plan is not paid" notice: what is wrong, how long is left (counted down live), and the exact
 * deadline. In the last 24 hours it turns red and says so. The remaining time is written in words and numbers, and
 * the bar is only a hint — never colour alone.
 */
export function OwnerPlanDueCard({ graceEnd, lastDay }: { graceEnd: Date; lastDay: boolean }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const now = useNow(30_000);

  const tone = lastDay ? theme.band.red : theme.band.amber;
  const accent = tone.solid;
  const leftMs = Math.max(0, graceEnd.getTime() - now);
  const days = Math.floor(leftMs / 86_400_000);
  const hours = Math.floor((leftMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((leftMs % 3_600_000) / 60_000);
  const left = days > 0 ? t('owner.billing.left.dh', { d: days, h: hours }) : t('owner.billing.left.hm', { h: hours, m: minutes });
  const elapsed = Math.min(1, Math.max(0, 1 - leftMs / WINDOW_MS));
  const deadline = graceEnd.toLocaleString(lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${t(lastDay ? 'owner.billing.lastDay.title' : 'owner.billing.grace.title')}. ${t('owner.billing.remaining')}: ${left}. ${t('owner.billing.deadline')}: ${deadline}`}
      style={{ flexDirection: 'row', borderRadius: 20, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: accent + '55' }}>
      <View style={{ width: 5, backgroundColor: accent }} />
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: accent + '22' }}>
            <ClockIcon color={accent} size={22} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: '700', fontSize: 16, lineHeight: 22 }}>{t(lastDay ? 'owner.billing.lastDay.title' : 'owner.billing.grace.title')}</AppText>
            <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
              {t('owner.billing.hint')}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText muted style={{ fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {t('owner.billing.remaining')}
            </AppText>
            <AppText style={{ fontWeight: '700', fontSize: 24, lineHeight: 30, color: accent }}>{left}</AppText>
          </View>
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: theme.border }} />
          <View style={{ flexShrink: 1, gap: 2 }}>
            <AppText muted style={{ fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {t('owner.billing.deadline')}
            </AppText>
            <AppText style={{ fontWeight: '700', fontSize: 15, lineHeight: 22 }}>{deadline}</AppText>
          </View>
        </View>

        <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.surfaceAlt }}>
          <View style={{ width: `${Math.round(elapsed * 100)}%`, height: 6, borderRadius: 3, backgroundColor: accent }} />
        </View>
      </View>
    </View>
  );
}

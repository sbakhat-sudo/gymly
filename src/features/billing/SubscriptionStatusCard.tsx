import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CalendarIcon } from '@/components/icons';
import { Orb } from '@/components/Orb';
import { decorativeA11yProps } from '@/lib/a11y';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import type { MySubscriptionState } from './billing-api';
import { TIER_BADGE_COLOR, TIER_LABEL_KEY } from './plan-tier';

function daysUntil(now: number, dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - now) / 86_400_000));
}

/**
 * The Client's own subscription at a glance — plan, price, and (the actual ask) a live "days until
 * it expires" countdown, on Storico since that's the screen a real Client already opens every day.
 * Same hero-card visual language as `PointsScreen.tsx`'s points balance (decorative `Orb`, a huge
 * `fontFamily.display` number, a pill below it) so it reads as a polished, intentional part of the
 * app rather than a bolted-on status line — the countdown number is the hero, same role the points
 * balance plays on its own screen.
 */
export function SubscriptionStatusCard({ state }: { state: MySubscriptionState | undefined }) {
  const { t } = useI18n();
  const theme = useTheme();
  // Hourly tick, not a direct `Date.now()` read during render — same reasoning as
  // `PaymentDueBanner.tsx`'s own countdown: day-granularity never needs finer.
  const now = useNow(60 * 60_000);

  const sub = state?.subscription;
  if (!sub) return null;

  const band = sub.status === 'active' ? theme.band.green : sub.status === 'grace' ? theme.band.amber : theme.band.red;
  const statusLabel = t(sub.status === 'active' ? 'billing.history.status.active' : sub.status === 'grace' ? 'billing.history.status.grace' : 'billing.history.status.blocked');

  // 'active': days until expiryDate. 'grace': days left to pay before blocked (graceEndDate) — the
  // same "running out" fact PaymentDueBanner already warns about elsewhere, shown here too since
  // this screen is where it'd actually get checked day to day. 'blocked' has nothing left to count
  // down — the subscription is already over, so no hero number, just the status itself.
  const days = sub.status === 'active' ? daysUntil(now, sub.expiryDate) : sub.status === 'grace' && sub.graceEndDate ? daysUntil(now, sub.graceEndDate) : null;
  const daysKey =
    sub.status === 'active'
      ? (`billing.history.daysLeft.${days === 1 ? 'one' : 'other'}` as const)
      : (`billing.history.daysLeftGrace.${days === 1 ? 'one' : 'other'}` as const);

  return (
    <View style={{ borderRadius: radius.xxl, paddingVertical: spacing.xl, paddingHorizontal: 22, gap: 6, backgroundColor: theme.surface, overflow: 'hidden' }}>
      <View {...decorativeA11yProps} style={{ pointerEvents: 'none', position: 'absolute', top: -110, right: -100, width: 300, height: 300 }}>
        <Orb color={band.solid} size={300} />
      </View>

      <AppText color={theme.textSoft} style={{ fontSize: 13, fontWeight: '600' }}>
        {t('billing.history.title')}
      </AppText>

      {days !== null ? (
        <>
          <AppText
            accessibilityLabel={`${days} ${t(daysKey)}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontFamily: fontFamily.display, fontSize: 64, lineHeight: 68, letterSpacing: 64 * -0.07 }}>
            {days}
          </AppText>
          <AppText muted style={{ fontSize: 13, fontWeight: '600', marginTop: -2 }}>
            {t(daysKey)}
          </AppText>
        </>
      ) : (
        <AppText style={{ fontSize: 15, fontWeight: '700', lineHeight: 21, maxWidth: 280 }}>{t('billing.due.blockedBody')}</AppText>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: band.soft }}>
          <AppText style={{ color: band.onSoft, fontSize: 12.5, fontWeight: '700' }}>{statusLabel}</AppText>
        </View>
        {sub.planTier && sub.planTier !== 'normal' ? (
          <View style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: TIER_BADGE_COLOR[sub.planTier] }}>
            <AppText style={{ color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4 }}>{t(TIER_LABEL_KEY[sub.planTier])}</AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: theme.chip }}>
          <CalendarIcon color={theme.textMuted} size={13} />
          <AppText style={{ fontSize: 12.5, lineHeight: 17, fontWeight: '600' }}>
            {sub.planName}
            {sub.priceEur !== null ? ` · €${sub.priceEur.toFixed(2)}` : ''}
          </AppText>
        </View>
      </View>

      {sub.planDescription ? (
        <AppText muted style={{ fontSize: 12.5, lineHeight: 18, marginTop: spacing.sm }}>
          {sub.planDescription}
        </AppText>
      ) : null}
    </View>
  );
}

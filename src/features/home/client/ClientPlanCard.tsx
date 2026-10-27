import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ChevronRightIcon, CreditCardIcon } from '@/components/icons';
import type { MySubscriptionState } from '@/features/billing/billing-api';
import { TIER_BADGE_COLOR, TIER_LABEL_KEY } from '@/features/billing/plan-tier';
import { avatarTint } from '@/lib/avatar-tint';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

const DAY_MS = 86_400_000;

function dayStart(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getTime();
}

/**
 * The subscription card the member is on, drawn like the card the gym made: its own colour, name, price and
 * description, how many days are left and how much of the period has gone. A plan with no colour of its own
 * (an old one) gets the same stable tint the Manager's list gives it. Hides itself without a subscription.
 */
export function ClientPlanCard({ state, onPress }: { state: MySubscriptionState | undefined; onPress?: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const now = useNow(60 * 60_000);
  const sub = state?.subscription;
  if (!sub) return null;

  const tint = sub.planColor ?? avatarTint(theme, sub.planName);
  const status = sub.status === 'active' ? theme.band.green : sub.status === 'grace' ? theme.band.amber : theme.band.red;
  const statusLabel = t(sub.status === 'active' ? 'billing.history.status.active' : sub.status === 'grace' ? 'billing.history.status.grace' : 'billing.history.status.blocked');

  const start = dayStart(sub.startDate);
  const end = dayStart(sub.expiryDate);
  const total = Math.max(1, end - start);
  const elapsed = Math.min(1, Math.max(0, (now - start) / total));
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY_MS));
  const expiryLabel = new Date(`${sub.expiryDate}T12:00:00`).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long' });

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${sub.planName}. ${t('home.client.plan.change')}` : undefined}
      style={({ pressed }) => [{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, opacity: pressed && onPress ? 0.92 : 1 }, CARD_SHADOW]}>
      <View style={{ height: 6, backgroundColor: tint }} />
      <View style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: `${tint}10` }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}26` }}>
            <CreditCardIcon color={tint} size={22} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {t('home.client.plan.label')}
            </AppText>
            <AppText numberOfLines={2} style={{ fontFamily: fontFamily.displaySemi, fontSize: 21, lineHeight: 26 }}>
              {sub.planName}
            </AppText>
          </View>
          {sub.planTier && sub.planTier !== 'normal' ? (
            <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: TIER_BADGE_COLOR[sub.planTier] }}>
              <AppText style={{ color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 }}>{t(TIER_LABEL_KEY[sub.planTier])}</AppText>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
          {sub.priceEur !== null ? <AppText style={{ fontFamily: fontFamily.display, fontSize: 30, lineHeight: 34, color: tint }}>€{sub.priceEur.toFixed(2)}</AppText> : <View />}
          <View style={{ alignItems: 'flex-end' }}>
            <AppText style={{ fontWeight: '800', fontSize: 18 }}>{sub.status === 'blocked' ? '—' : t(daysLeft === 1 ? 'home.client.plan.dayLeft' : 'home.client.plan.daysLeft', { n: daysLeft })}</AppText>
            <AppText muted variant="caption">
              {t('home.client.plan.until', { date: expiryLabel })}
            </AppText>
          </View>
        </View>

        <View accessible accessibilityLabel={t('home.client.plan.progress', { pct: Math.round(elapsed * 100) })} style={{ height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(elapsed * 100)}%`, height: 8, borderRadius: 4, backgroundColor: tint }} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: status.soft }}>
            <AppText style={{ color: status.onSoft, fontSize: 12.5, fontWeight: '700' }}>{statusLabel}</AppText>
          </View>
        </View>

        {sub.planDescription ? (
          <AppText muted style={{ fontSize: 13, lineHeight: 19 }}>
            {sub.planDescription}
          </AppText>
        ) : null}

        {onPress ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
            <AppText style={{ color: tint, fontWeight: '800', fontSize: 14 }}>{t('home.client.plan.change')}</AppText>
            <ChevronRightIcon color={tint} size={18} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

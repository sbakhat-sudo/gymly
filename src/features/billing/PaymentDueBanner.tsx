import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { AlertTriangleIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { PaymentService } from '@/lib/billing/payment-service';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { confirmPaymentDuringGrace, getMySubscription } from './billing-api';

/**
 * Non-blocking, unlike `PlanChoiceModal` — "tutti tranne chi ha un annuale valido vedono devi pagare"
 * (everyone except someone with a valid paid plan sees this), shown as a persistent card on Home, not
 * another full-screen gate. Re-checked every time Home regains focus (`useIsFocused`, same pattern as
 * `WeeklyGoalPopup.tsx` — Expo Router keeps every tab mounted, so a mount-only effect would never
 * notice the server's own cron job moving the status along while the Client was on another tab).
 */
export function PaymentDueBanner() {
  const { t } = useI18n();
  const theme = useTheme();
  const focused = useIsFocused();
  const subscription = useAsync(() => getMySubscription(), [focused], focused);
  // Day-granularity countdown — an hourly tick is more than enough, and keeps this a pure read of
  // `now` (never a direct `Date.now()` call during render).
  const now = useNow(60 * 60_000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const sub = subscription.data?.subscription;
  if (!sub || sub.status === 'active') return null;

  const daysLeft = sub.graceEndDate ? Math.max(0, Math.ceil((new Date(`${sub.graceEndDate}T00:00:00`).getTime() - now) / 86_400_000)) : 0;

  async function payNow(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const result = await PaymentService.charge({ planType: sub!.planType });
      if (!result.success) throw new Error('payment failed');
      await confirmPaymentDuringGrace();
      subscription.reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[{ flexDirection: 'row', borderRadius: radius.card, backgroundColor: theme.surface, overflow: 'hidden' }, CARD_SHADOW]}>
      <View style={{ width: 4, backgroundColor: theme.danger }} />
      <View style={{ flex: 1, padding: spacing.md, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AlertTriangleIcon color={theme.danger} size={16} />
          <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>{t(sub.status === 'blocked' ? 'billing.due.blockedTitle' : 'billing.due.title')}</AppText>
        </View>
        <AppText muted style={{ fontSize: 13.5, lineHeight: 18 }}>
          {sub.status === 'blocked' ? t('billing.due.blockedBody') : t('billing.due.gradeBody', { days: daysLeft })}
        </AppText>
        {error ? (
          <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600' }}>
            {t('billing.due.error')}
          </AppText>
        ) : null}
        <Button label={t('billing.due.payNow')} onPress={() => void payNow()} disabled={busy} />
        {busy ? <ActivityIndicator /> : null}
      </View>
    </View>
  );
}

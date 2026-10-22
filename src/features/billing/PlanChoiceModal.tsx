import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CalendarIcon, CheckIcon, ClockIcon, CreditCardIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import { choosePlan, type PlanType } from './billing-api';
import { PaymentService } from '@/lib/billing/payment-service';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

const PLAN_ICON: Record<PlanType, IconType> = { monthly: ClockIcon, annual: CalendarIcon };

/**
 * Mandatory, non-dismissible — same mechanism as `ManagerSignupScreen.tsx`'s `PlanPickerModal`
 * ("a Manager account doesn't exist until one is picked"): an opaque-background `Modal` with no
 * backdrop-dismiss `Pressable` and no cancel path. Mounted at the root (`NavigatorStack` in
 * `src/app/_layout.tsx`), not inside a single screen, so it blocks the whole app regardless of which
 * tab is active, and never needs to touch `auth-context.tsx#resolve()`'s own branching.
 */
export function PlanChoiceModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [step, setStep] = useState<'choose' | 'pay'>('choose');
  const [plan, setPlan] = useState<PlanType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(p: PlanType): void {
    setPlan(p);
    setStep('pay');
    setError(null);
  }

  async function pay(): Promise<void> {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const result = await PaymentService.charge({ planType: plan });
      if (!result.success) throw new Error('payment failed');
      await choosePlan(plan);
      onDone();
    } catch {
      setError(t('billing.choice.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.background, padding: spacing.lg, paddingTop: spacing.xxl * 1.5, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <AppText style={{ fontFamily: fontFamily.display, fontSize: 28 }}>{t('billing.choice.title')}</AppText>
          <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
            {step === 'choose' ? t('billing.choice.subtitle') : t('billing.pay.subtitle')}
          </AppText>
        </View>

        {step === 'choose' ? (
          <View style={{ gap: spacing.md }}>
            {(['monthly', 'annual'] as const).map((p) => {
              const Icon = PLAN_ICON[p];
              return (
                <Pressable
                  key={p}
                  onPress={() => pick(p)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderRadius: radius.card,
                    backgroundColor: theme.glass,
                    borderWidth: 1.5,
                    borderColor: theme.glassBorder,
                    opacity: pressed ? 0.85 : 1,
                  })}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${theme.primary}22`, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon color={theme.primary} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '800', fontSize: 17 }}>{t(p === 'monthly' ? 'billing.plan.monthly' : 'billing.plan.annual')}</AppText>
                    <AppText muted style={{ fontSize: 13 }}>
                      {t(p === 'monthly' ? 'billing.plan.monthly.help' : 'billing.plan.annual.help')}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: theme.band.amber.soft }}>
              <AppText style={{ color: theme.band.amber.onSoft, fontWeight: '700', fontSize: 12 }}>{t('billing.pay.demoBadge')}</AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
              <CreditCardIcon color={theme.textMuted} size={22} />
              <AppText style={{ flex: 1, fontWeight: '700', fontSize: 15 }}>{t(plan === 'monthly' ? 'billing.plan.monthly' : 'billing.plan.annual')}</AppText>
              <CheckIcon color={theme.band.green.solid} size={18} />
            </View>

            {error ? <Banner title={error} /> : null}

            <Button label={t('billing.pay.submit')} onPress={() => void pay()} disabled={busy} />
            {busy ? <ActivityIndicator /> : null}
            <AppText onPress={() => setStep('choose')} style={{ color: theme.primary, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
              {t('billing.pay.changePlan')}
            </AppText>
          </View>
        )}
      </View>
    </Modal>
  );
}

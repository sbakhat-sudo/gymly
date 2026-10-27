import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckIcon, XIcon } from '@/components/icons';
import { PLAN_FEATURES_KEY, PLAN_NAME_KEY, PLAN_ORDER, PLAN_PRICE_KEY, planAccent, type ManagerPlan } from '@/features/auth/ManagerPlanCards';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { changeOwnerPlan, getOwnerPlanBilling, type OwnerPlanBilling } from './owner-api';

/**
 * "Il tuo piano" in the Owner's Impostazioni: which Gymly plan the Owner is on and what it costs, whether it is
 * paid, and "Cambia piano". The one rule: from a paid plan there is no way back to the free Trial — Pro and
 * Business can be swapped for each other, Trial is shown but locked (the database refuses it too, see
 * `owner_change_plan()`). Moving off Trial makes the paid plan due at once, so that change asks for an explicit
 * confirmation that says so.
 */
export function OwnerPlanSection() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const billing = useAsync(() => getOwnerPlanBilling(), []);
  const now = useNow(60_000);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<ManagerPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const data = billing.data ?? null;
  if (!data) return null;

  const date = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const status = ((b: OwnerPlanBilling): string => {
    if (b.status === 'grace') return t('owner.plan.status.grace', { date: date(b.graceEnd) });
    if (b.plan === 'trial') return t('owner.plan.status.trial', { date: date(b.paidUntil) });
    // A paid plan whose paid period has not started yet (just chosen) is simply due.
    if (b.paidUntil && new Date(b.paidUntil).getTime() <= now) return t('owner.plan.status.due');
    return t('owner.plan.status.paid', { date: date(b.paidUntil) });
  })(data);

  async function confirmChange(): Promise<void> {
    if (!pending || pending === 'trial') return;
    setSaving(true);
    setError(false);
    try {
      await changeOwnerPlan(pending);
      billing.reload();
      setPending(null);
    } catch {
      setError(true);
      setPending(null);
    } finally {
      setSaving(false);
    }
  }

  const fromName = t(PLAN_NAME_KEY[data.plan]);
  const toName = pending ? t(PLAN_NAME_KEY[pending]) : '';
  const accent = planAccent(data.plan, theme);
  const overdue = data.status === 'grace';

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" style={{ paddingHorizontal: 6, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, color: theme.textMuted }}>
          {t('owner.plan.title')}
        </AppText>
        <View style={{ borderRadius: 20, borderWidth: 1, borderColor: accent + '55', backgroundColor: accent + '14', padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: accent + '26' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
              <AppText style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{t('owner.plan.current')}</AppText>
            </View>
            <AppText style={{ fontSize: 14, fontWeight: '600', color: theme.textMuted }}>{t(PLAN_PRICE_KEY[data.plan])}</AppText>
          </View>
          <AppText variant="display" style={{ fontSize: 32, lineHeight: 38 }}>
            {fromName}
          </AppText>
          <AppText style={{ fontSize: 13.5, lineHeight: 19, color: overdue ? theme.band.red.solid : theme.textMuted, fontWeight: overdue ? '700' : '400' }}>{status}</AppText>
          <Pressable
            onPress={() => {
              setError(false);
              setPicking(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('owner.plan.change')}
            style={({ pressed }) => ({ minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 })}>
            <AppText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{t('owner.plan.change')}</AppText>
          </Pressable>
        </View>
      </View>

      {error ? <Banner title={t('owner.plan.error')} /> : null}

      <Modal visible={picking} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPicking(false)}>
        <Pressable onPress={() => setPicking(false)} accessibilityLabel={t('common.close')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => {}}
            style={{ width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flexShrink: 1, gap: 4 }}>
                <AppText variant="display" style={{ fontSize: 22 }}>
                  {t('owner.plan.modal.title')}
                </AppText>
                <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
                  {t('owner.plan.modal.subtitle')}
                </AppText>
              </View>
              <Pressable
                onPress={() => setPicking(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
                <XIcon color={theme.text} size={18} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }} showsVerticalScrollIndicator={false}>
              {PLAN_ORDER.map((plan) => {
                const current = plan === data.plan;
                // Trial is only ever the starting point: once on a paid plan it is shown, but locked.
                const locked = plan === 'trial' && data.plan !== 'trial';
                const disabled = current || locked;
                const color = planAccent(plan, theme);
                return (
                  <Pressable
                    key={plan}
                    onPress={() => {
                      setPicking(false);
                      setPending(plan);
                    }}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected: current }}
                    accessibilityLabel={`${t(PLAN_NAME_KEY[plan])}, ${t(PLAN_PRICE_KEY[plan])}${current ? `, ${t('owner.plan.badge.current')}` : locked ? `, ${t('owner.plan.trialLocked')}` : ''}`}
                    style={({ pressed }) => ({
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: 18,
                      borderWidth: current ? 2 : 1,
                      borderColor: current ? color : theme.border,
                      backgroundColor: current ? color + '14' : theme.surface,
                      opacity: locked ? 0.5 : pressed ? 0.85 : 1,
                    })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: current ? color : theme.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: current ? color : 'transparent',
                        }}>
                        {current ? <CheckIcon color="#FFFFFF" size={12} strokeWidth={3.5} /> : null}
                      </View>
                      <AppText style={{ flex: 1, fontFamily: fontFamily.displaySemi, fontSize: 18 }}>{t(PLAN_NAME_KEY[plan])}</AppText>
                      <AppText style={{ fontWeight: '700', fontSize: 15 }}>{t(PLAN_PRICE_KEY[plan])}</AppText>
                    </View>
                    <View style={{ gap: 5, paddingLeft: 34 }}>
                      {t(PLAN_FEATURES_KEY[plan])
                        .split('|')
                        .map((feature) => (
                          <AppText key={feature} muted style={{ fontSize: 13.5 }}>
                            {feature}
                          </AppText>
                        ))}
                    </View>
                    {locked ? (
                      <AppText muted style={{ fontSize: 12.5, paddingLeft: 34 }}>
                        {t('owner.plan.trialLocked')}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={pending !== null}
        title={t('owner.plan.confirm.title')}
        message={t(data.plan === 'trial' ? 'owner.plan.confirm.fromTrial' : 'owner.plan.confirm.switch', { from: fromName, to: toName })}
        confirmLabel={t('owner.plan.confirm.action')}
        onConfirm={() => {
          if (!saving) void confirmChange();
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

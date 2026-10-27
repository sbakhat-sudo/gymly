import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckIcon, LayersIcon, XIcon } from '@/components/icons';
import { SettingsGroup, SettingsIcon } from '@/components/settings/SettingsKit';
import { PLAN_FEATURES_KEY, PLAN_NAME_KEY, PLAN_ORDER, PLAN_PRICE_KEY, planAccent, type ManagerPlan } from '@/features/auth/ManagerPlanCards';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
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

  return (
    <>
      <SettingsGroup title={t('owner.plan.title')}>
        <View style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <SettingsIcon icon={LayersIcon} tint={planAccent(data.plan, theme)} />
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="caption" muted style={{ fontWeight: '600' }}>
              {t('owner.plan.current')}
            </AppText>
            <AppText style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {fromName} · {t(PLAN_PRICE_KEY[data.plan])}
            </AppText>
            <AppText muted style={{ fontSize: 12.5 }} numberOfLines={2}>
              {status}
            </AppText>
          </View>
          <AppText
            onPress={() => {
              setError(false);
              setPicking(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('owner.plan.change')}
            style={{ color: theme.primary, fontWeight: '700', fontSize: 13, paddingVertical: 8, paddingLeft: 8 }}>
            {t('owner.plan.change')}
          </AppText>
        </View>
      </SettingsGroup>

      {error ? <Banner title={t('owner.plan.error')} /> : null}

      <Modal visible={picking} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 520, maxHeight: '92%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <AppText variant="display" style={{ fontSize: 20 }}>
                  {t('owner.plan.modal.title')}
                </AppText>
                <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
                  {t('owner.plan.modal.subtitle')}
                </AppText>
              </View>
              <Pressable onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
                <XIcon color={theme.text} size={20} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
              {PLAN_ORDER.map((plan) => {
                const current = plan === data.plan;
                // Trial is only ever the starting point: once on a paid plan it is shown, but locked.
                const locked = plan === 'trial' && data.plan !== 'trial';
                const disabled = current || locked;
                const accent = planAccent(plan, theme);
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
                      borderRadius: radius.card,
                      borderWidth: current ? 2 : 1,
                      borderColor: current ? accent : theme.border,
                      backgroundColor: theme.surface,
                      opacity: locked ? 0.55 : pressed ? 0.85 : 1,
                    })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: accent }} />
                      <AppText style={{ flex: 1, fontFamily: fontFamily.displaySemi, fontSize: 17 }}>{t(PLAN_NAME_KEY[plan])}</AppText>
                      <AppText style={{ fontWeight: '700', fontSize: 15 }}>{t(PLAN_PRICE_KEY[plan])}</AppText>
                    </View>
                    <View style={{ gap: 4 }}>
                      {t(PLAN_FEATURES_KEY[plan])
                        .split('|')
                        .map((feature) => (
                          <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <CheckIcon color={accent} size={14} strokeWidth={3} />
                            <AppText style={{ fontSize: 13.5 }}>{feature}</AppText>
                          </View>
                        ))}
                    </View>
                    {current ? (
                      <AppText style={{ color: accent, fontWeight: '700', fontSize: 12.5 }}>{t('owner.plan.badge.current')}</AppText>
                    ) : locked ? (
                      <AppText muted style={{ fontSize: 12.5 }}>
                        {t('owner.plan.trialLocked')}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
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

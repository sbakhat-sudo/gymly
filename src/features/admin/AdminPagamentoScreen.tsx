import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { Card, SectionLabel, SectionTitle } from '@/components/Card';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { CreditCardIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { DEMO_MODE } from '@/lib/demo-mode';
import { useI18n } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getSites, type SitePlan } from './admin-api';

const MOCK_HISTORY = [
  { label: '01/09/2026', amount: '€49,00' },
  { label: '01/08/2026', amount: '€49,00' },
  { label: '01/07/2026', amount: '€49,00' },
];

const PLAN_TIERS: { id: SitePlan; name: string; price: string; features: string[] }[] = [
  { id: 'trial', name: 'Trial', price: 'Gratis', features: ['14 giorni di prova', '1 palestra'] },
  { id: 'pro', name: 'Pro', price: '€49/mese', features: ['Palestre illimitate', 'Report avanzati'] },
  { id: 'business', name: 'Business', price: '€129/mese', features: ['Tutto di Pro', 'Supporto dedicato', 'SLA garantito'] },
];
const CURRENT_PLAN_ID: SitePlan = 'pro';

/**
 * Placeholder UI for the platform's OWN billing (no real payment gateway connected — a real system
 * needs a provider, a pricing model and PCI-aware handling of card data, a separate project). The
 * per-plan "X gyms on this plan" counts are the one real thing on this screen: `sites.plan` is a
 * genuine, admin-editable column (see AdminSitesScreen's "Cambia piano"), counted live here.
 *
 * Gated by `DEMO_MODE`: with it on (the default), the full placeholder UI shows behind a loud
 * `DemoModeBanner`. With it off (a real deployment, `EXPO_PUBLIC_DEMO_MODE=false`), none of the made-up
 * plan/payment-method/history content renders — only the genuinely real per-plan site counts do.
 */
export function AdminPagamentoScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const sites = useAsync(() => getSites(), []);

  const countByPlan = (plan: SitePlan): number => sites.data?.filter((s) => s.plan === plan).length ?? 0;

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <BackButton href="/(admin)/impostazioni" />
        <PageTitle icon={CreditCardIcon} label={t('admin.billing.title')} />
      </View>

      {DEMO_MODE ? <DemoModeBanner /> : null}
      {sites.error ? <Banner title={t('admin.sites.error')} /> : null}

      {DEMO_MODE ? (
        <>
          <Banner title={t('admin.billing.placeholder.title')} message={t('admin.billing.placeholder.body')} />

          <Card>
            <SectionTitle>{t('admin.billing.plan.title')}</SectionTitle>
            <AppText style={{ fontSize: 22, fontWeight: '800' }}>{t('admin.billing.plan.name')}</AppText>
            <AppText variant="caption" muted>
              {t('admin.billing.plan.renewal', { date: '01/10/2026' })}
            </AppText>
          </Card>

          <SectionLabel>{t('admin.billing.plans.title')}</SectionLabel>
          {PLAN_TIERS.map((p) => {
            const current = p.id === CURRENT_PLAN_ID;
            return (
              <View
                key={p.id}
                style={{
                  borderRadius: 18,
                  padding: spacing.lg,
                  gap: 6,
                  backgroundColor: current ? theme.primary : theme.surface,
                  borderWidth: current ? 0 : 1,
                  borderColor: theme.border,
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText color={current ? theme.onPrimary : theme.text} style={{ fontSize: 17, fontWeight: '800' }}>
                    {p.name}
                  </AppText>
                  <AppText color={current ? theme.onPrimary : theme.text} style={{ fontSize: 15, fontWeight: '700' }}>
                    {p.price}
                  </AppText>
                </View>
                {p.features.map((f) => (
                  <AppText key={f} color={current ? theme.onPrimary : theme.textMuted} style={{ fontSize: 13 }}>
                    · {f}
                  </AppText>
                ))}
                <AppText color={current ? theme.onPrimary : theme.textMuted} style={{ fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  {sites.data ? t('admin.billing.plans.users', { count: countByPlan(p.id) }) : '…'}
                </AppText>
                {current ? (
                  <AppText color={theme.onPrimary} style={{ fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 11 * 0.08 }}>
                    {t('admin.billing.plans.current')}
                  </AppText>
                ) : null}
              </View>
            );
          })}

          <Card>
            <SectionTitle>{t('admin.billing.method.title')}</SectionTitle>
            <AppText style={{ fontSize: 15 }}>{t('admin.billing.method.example')}</AppText>
          </Card>

          <SectionLabel>{t('admin.billing.history.title')}</SectionLabel>
          <Card>
            {MOCK_HISTORY.map((h, i) => (
              <View
                key={h.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: theme.border }}>
                <AppText>{h.label}</AppText>
                <AppText style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{h.amount}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <Banner title={t('admin.billing.unavailable.title')} message={t('admin.billing.unavailable.body')} />

          <SectionLabel>{t('admin.billing.plans.title')}</SectionLabel>
          <Card>
            {PLAN_TIERS.map((p, i) => (
              <View
                key={p.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: theme.border }}>
                <AppText>{p.name}</AppText>
                <AppText style={{ fontWeight: '700' }}>{sites.data ? t('admin.billing.plans.users', { count: countByPlan(p.id) }) : '…'}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

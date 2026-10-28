import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreditCardIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { getManagersCanCreateCards } from '@/features/billing/billing-api';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import {
  createOwnerPlanCard,
  deleteOwnerPlanCard,
  getOwnerPlanCards,
  setManagersCanCreateCards,
  setOwnerPlanCardActive,
  updateOwnerPlanCard,
  type OwnerPlanCard,
} from './owner-api';
import { PlanCardModal } from './PlanCardModal';

/**
 * "Abbonamenti" — the Owner's own catalog: free-text name, monthly or annual, and the day it was
 * created. Every Manager in the chain sees these cards and assigns them to Clients; Managers can't
 * edit them. A switch lets the Owner also allow Managers to make cards of their own.
 */
export function OwnerPlansScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const isSidebar = useSidebarMode();
  const cards = useAsync(() => getOwnerPlanCards(), []);
  const allowed = useAsync(() => getManagersCanCreateCards(), []);
  const [sheet, setSheet] = useState<'new' | OwnerPlanCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OwnerPlanCard | null>(null);
  const [actionError, setActionError] = useState(false);
  usePageHeader(CreditCardIcon, t('owner.plans.title'));

  async function run(action: () => Promise<void>): Promise<void> {
    setActionError(false);
    try {
      await action();
      cards.reload();
    } catch {
      setActionError(true);
    }
  }

  return (
    <Screen onRefresh={cards.reload} refreshing={cards.loading && cards.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: 2, flex: 1 }}>
          {/* Sidebar mode already shows this title in the fixed top bar (`usePageHeader` above). */}
          {!isSidebar ? <AppText style={{ fontSize: 26, fontWeight: '800' }}>{t('owner.plans.title')}</AppText> : null}
          <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
            {t('owner.plans.subtitle')}
          </AppText>
        </View>
        <Pressable
          onPress={() => setSheet('new')}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.primary }}>
          <PlusIcon color={theme.onPrimary} size={16} strokeWidth={2.4} />
          <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>{t('owner.plans.new')}</AppText>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <UsersIcon color={theme.primary} size={20} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>{t('owner.plans.managersCreate')}</AppText>
          <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
            {t(allowed.data === true ? 'owner.plans.managersCreateHelpOn' : 'owner.plans.managersCreateHelp')}
          </AppText>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Toggle
            value={allowed.data === true}
            disabled={allowed.data === undefined}
            accessibilityLabel={t('owner.plans.managersCreate')}
            onValueChange={(next) => {
              setActionError(false);
              setManagersCanCreateCards(next)
                .then(() => allowed.reload())
                .catch(() => setActionError(true));
            }}
          />
          <AppText variant="caption" style={{ fontWeight: '700', color: allowed.data === true ? theme.primary : theme.textMuted }}>
            {t(allowed.data === true ? 'owner.plans.on' : 'owner.plans.off')}
          </AppText>
        </View>
      </View>

      {cards.error || actionError ? <Banner title={t('owner.plans.error')} /> : null}
      {cards.data === undefined && cards.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {cards.data && cards.data.length === 0 ? <EmptyState message={t('owner.plans.empty')} icon={CreditCardIcon} /> : null}

      {cards.data && cards.data.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {cards.data.map((c) => {
            const tint = c.color ?? avatarTint(theme, c.name);
            return (
              <Pressable
                key={c.id}
                onPress={() => setSheet(c)}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                style={({ pressed }) => ({
                  minWidth: 200,
                  flexGrow: 1,
                  flexBasis: 220,
                  padding: spacing.md,
                  borderRadius: radius.card,
                  backgroundColor: `${tint}0f`,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                  borderTopWidth: 3,
                  borderTopColor: tint,
                  opacity: pressed ? 0.85 : c.active ? 1 : 0.55,
                  gap: 4,
                })}>
                <AppText numberOfLines={2} style={{ fontWeight: '800', fontSize: 16 }}>
                  {c.name}
                </AppText>
                <AppText style={{ color: tint, fontWeight: '700', fontSize: 13 }}>
                  {t(c.kind === 'annual' ? 'owner.plans.kind.annual' : 'owner.plans.kind.monthly')}
                  {!c.active ? ` · ${t('owner.plans.inactive')}` : ''}
                </AppText>
                <AppText style={{ fontWeight: '800', fontSize: 20, color: tint }}>€{c.priceEur.toFixed(2)}</AppText>
                <AppText variant="caption" muted style={{ fontWeight: '600' }}>
                  {t(c.includesCoach ? 'plan.coach.included' : 'plan.coach.notIncluded')}
                </AppText>
                {c.description ? (
                  <AppText muted numberOfLines={3} style={{ fontSize: 12.5 }}>
                    {c.description}
                  </AppText>
                ) : null}
                <AppText variant="caption" muted>
                  {t('owner.plans.createdOn', { date: new Date(c.createdAt).toLocaleDateString(lang) })}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <PlanCardModal
        target={sheet}
        takenColors={(cards.data ?? []).filter((c) => sheet === 'new' || sheet === null || c.id !== sheet.id).map((c) => c.color)}
        onClose={() => setSheet(null)}
        onSave={(input) =>
          run(async () => {
            if (sheet !== null && sheet !== 'new') await updateOwnerPlanCard(sheet.id, input);
            else await createOwnerPlanCard(input);
            setSheet(null);
          })
        }
        onToggleActive={(c) =>
          run(async () => {
            await setOwnerPlanCardActive(c.id, !c.active);
            setSheet(null);
          })
        }
        onAskDelete={(c) => {
          setSheet(null);
          setConfirmDelete(c);
        }}
      />

      <ConfirmDialog
        visible={confirmDelete !== null}
        destructive
        title={t('owner.plans.deleteConfirm.title')}
        message={t('owner.plans.deleteConfirm.body', { name: confirmDelete?.name ?? '' })}
        confirmLabel={t('owner.plans.delete')}
        onConfirm={() => {
          const c = confirmDelete;
          setConfirmDelete(null);
          if (c) void run(() => deleteOwnerPlanCard(c.id));
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

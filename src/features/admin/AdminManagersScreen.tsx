import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { GroupHeader } from '@/components/GroupHeader';
import { ChevronRightIcon, ClockIcon, UsersIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/lib/theme';

import { AdminActionRow } from './AdminActionRow';
import { getActionsLog, getPendingOwners, setOwnerStatus, type AdminActionType, type PendingManager, type SitePlan } from './admin-api';

/** Request-decision action types only — site/manager plan/GPS/reassign changes have their own log
 * elsewhere (Dashboard's "Ultime azioni Admin"), not shown as part of this page's request history.
 * `site_approved`/`site_suspended` can still appear here from `AdminSitesScreen.tsx`'s own, separate
 * general site-management actions — this page itself no longer has any site-approval UI of its own. */
const REQUEST_HISTORY_TYPES: AdminActionType[] = ['site_approved', 'site_suspended', 'manager_activated', 'manager_deactivated', 'owner_activated', 'owner_deactivated'];

const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};

/** Admin approves pending Owner signups — the only approval queue in the app (Manager no longer
 * self-registers, and a new Manager's gym is created already-active by the Owner's own "Aggiungi
 * Manager" flow, so there's never a new site waiting on Admin either). Internal names here still say
 * "manager" in a few spots (`ManagerRow`, `managerSheetActions`, `decideManager`) — purely cosmetic
 * leftovers from before that changed; the actual data source below is `getPendingOwners()`. */
export function AdminManagersScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const managers = useAsync(() => getPendingOwners(), []);
  const actionsLog = useAsync(() => getActionsLog(50), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetManager, setSheetManager] = useState<PendingManager | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const pendingManagers = managers.data ?? [];
  const requestHistory = (actionsLog.data ?? []).filter((a) => REQUEST_HISTORY_TYPES.includes(a.actionType));
  const loading = managers.loading && managers.data === undefined;

  function reloadAll(): void {
    managers.reload();
    actionsLog.reload();
  }

  async function decideManager(manager: PendingManager, status: 'active' | 'rejected'): Promise<void> {
    setBusyId(manager.userId);
    try {
      await setOwnerStatus(manager.userId, status);
      managers.reload();
      actionsLog.reload();
      setSheetManager(null);
    } finally {
      setBusyId(null);
    }
  }

  const managerSheetActions: ActionSheetAction[] = sheetManager
    ? [
        { label: t('admin.sites.approve'), onPress: () => void decideManager(sheetManager, 'active'), disabled: busyId === sheetManager.userId },
        {
          label: t('admin.managers.reject'),
          destructive: true,
          onPress: () => {
            setSheetManager(null);
            setPendingConfirm({
              title: t('admin.managers.rejectManager.confirm.title'),
              message: t('admin.managers.rejectManager.confirm.body', { manager: sheetManager.fullName ?? t('common.unnamedPerson') }),
              confirmLabel: t('admin.managers.reject'),
              onConfirm: () => void decideManager(sheetManager, 'rejected'),
            });
          },
          disabled: busyId === sheetManager.userId,
        },
      ]
    : [];

  return (
    <Screen onRefresh={reloadAll} refreshing={managers.loading && !loading}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <ScreenHeader icon={UsersIcon} label={t('admin.managers.title')} />
        <AppText muted style={{ fontSize: 14 }}>
          {t('admin.dashboard.pendingApprovals')}
        </AppText>
      </View>

      {managers.error ? <Banner title={t('admin.sites.error')} /> : null}
      {loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}

      {pendingManagers.length > 0 ? (
        <>
          <GroupHeader icon={UsersIcon} label={t('admin.managers.newOwners')} />
          <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
            {pendingManagers.map((m, i) => (
              <ManagerRow key={m.userId} manager={m} showDivider={i > 0} onPress={() => setSheetManager(m)} />
            ))}
          </View>
        </>
      ) : null}

      <GroupHeader icon={ClockIcon} label={t('admin.managers.history.title')} />
      {actionsLog.error ? <Banner title={t('admin.actionsLog.error')} /> : null}
      {actionsLog.data === undefined && actionsLog.loading ? <ActivityIndicator style={{ marginTop: spacing.sm }} /> : null}
      {actionsLog.data && requestHistory.length === 0 ? (
        <AppText variant="caption" muted>
          {t('admin.managers.history.empty')}
        </AppText>
      ) : null}
      {requestHistory.length > 0 ? (
        <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          {requestHistory.map((entry, i, rows) => (
            <AdminActionRow key={entry.id} entry={entry} last={i === rows.length - 1} absolute />
          ))}
        </View>
      ) : null}

      <ActionSheet
        visible={sheetManager !== null}
        title={sheetManager?.fullName ?? t('common.unnamedPerson')}
        subtitle={sheetManager?.requestedPlan ? t(PLAN_LABEL_KEY[sheetManager.requestedPlan]) : undefined}
        actions={managerSheetActions}
        onClose={() => setSheetManager(null)}
      />

      <ConfirmDialog
        visible={pendingConfirm !== null}
        destructive
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel ?? ''}
        onConfirm={() => {
          pendingConfirm?.onConfirm();
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </Screen>
  );
}

function ManagerRow({ manager, showDivider, onPress }: { manager: PendingManager; showDivider: boolean; onPress: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={manager.fullName ?? t('common.unnamedPerson')}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 68,
          paddingHorizontal: spacing.md,
          borderTopWidth: showDivider ? 1 : 0,
          borderTopColor: theme.glassBorder,
        },
        pressed ? { backgroundColor: theme.surfaceAlt } : null,
      ]}>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 15 }}>
          {manager.fullName ?? t('common.unnamedPerson')}
        </AppText>
        <AppText numberOfLines={1} variant="caption" muted>
          {manager.requestedPlan ? t(PLAN_LABEL_KEY[manager.requestedPlan]) : t('admin.managers.noPlan')}
        </AppText>
        <AppText variant="caption" muted style={{ fontSize: 11 }}>
          {t('admin.managers.pending.requestedOn', { date: new Date(manager.createdAt).toLocaleDateString(lang) })}
        </AppText>
      </View>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

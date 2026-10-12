import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { SectionLabel } from '@/components/Card';
import { ChevronRightIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/lib/theme';

import { getPendingManagers, getSites, setManagerStatus, setSiteStatus, type AdminSite, type PendingManager, type SitePlan } from './admin-api';

const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};

/** Admin's reach is Manager accounts only — never coach or client directly (those stay each gym's own Manager's job). */
export function AdminManagersScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const managers = useAsync(() => getPendingManagers(), []);
  const sites = useAsync(() => getSites(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetSite, setSheetSite] = useState<AdminSite | null>(null);
  const [sheetManager, setSheetManager] = useState<PendingManager | null>(null);

  const pendingSites = (sites.data ?? []).filter((s) => s.approvalStatus === 'pending_approval');
  const pendingManagers = managers.data ?? [];
  const loading = (managers.loading && managers.data === undefined) || (sites.loading && sites.data === undefined);
  const nothingPending = managers.data !== undefined && sites.data !== undefined && pendingManagers.length === 0 && pendingSites.length === 0;

  function reloadAll(): void {
    managers.reload();
    sites.reload();
  }

  async function decideSite(site: AdminSite, status: 'active' | 'suspended'): Promise<void> {
    setBusyId(site.siteId);
    try {
      await setSiteStatus(site.siteId, status);
      sites.reload();
      setSheetSite(null);
    } finally {
      setBusyId(null);
    }
  }

  async function decideManager(manager: PendingManager, status: 'active' | 'rejected'): Promise<void> {
    setBusyId(manager.userId);
    try {
      await setManagerStatus(manager.userId, status);
      managers.reload();
      setSheetManager(null);
    } finally {
      setBusyId(null);
    }
  }

  const siteSheetActions: ActionSheetAction[] = sheetSite
    ? [
        { label: t('admin.sites.approve'), onPress: () => void decideSite(sheetSite, 'active'), disabled: busyId === sheetSite.siteId },
        { label: t('admin.managers.reject'), destructive: true, onPress: () => void decideSite(sheetSite, 'suspended'), disabled: busyId === sheetSite.siteId },
      ]
    : [];

  const managerSheetActions: ActionSheetAction[] = sheetManager
    ? [
        { label: t('admin.sites.approve'), onPress: () => void decideManager(sheetManager, 'active'), disabled: busyId === sheetManager.userId },
        { label: t('admin.managers.reject'), destructive: true, onPress: () => void decideManager(sheetManager, 'rejected'), disabled: busyId === sheetManager.userId },
      ]
    : [];

  return (
    <Screen onRefresh={reloadAll} refreshing={(managers.loading || sites.loading) && !loading}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('admin.managers.title')}
        </AppText>
        <AppText muted style={{ fontSize: 14 }}>
          {t('admin.dashboard.pendingApprovals')}
        </AppText>
      </View>

      {managers.error || sites.error ? <Banner title={t('admin.sites.error')} /> : null}
      {loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {nothingPending ? <Banner message={t('admin.dashboard.pendingApprovals.empty')} /> : null}

      {pendingManagers.length > 0 ? (
        <>
          <SectionLabel>{t('admin.managers.newManagers')}</SectionLabel>
          <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
            {pendingManagers.map((m, i) => (
              <ManagerRow key={m.userId} manager={m} showDivider={i > 0} onPress={() => setSheetManager(m)} />
            ))}
          </View>
        </>
      ) : null}

      {pendingSites.length > 0 ? (
        <>
          <SectionLabel>{t('admin.managers.newGyms')}</SectionLabel>
          <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
            {pendingSites.map((s, i) => (
              <SiteRow key={s.siteId} site={s} showDivider={i > 0} onPress={() => setSheetSite(s)} />
            ))}
          </View>
        </>
      ) : null}

      <ActionSheet
        visible={sheetSite !== null}
        title={sheetSite?.name ?? ''}
        subtitle={sheetSite?.managerName ?? undefined}
        actions={siteSheetActions}
        onClose={() => setSheetSite(null)}
      />
      <ActionSheet
        visible={sheetManager !== null}
        title={sheetManager?.fullName ?? t('common.unnamedPerson')}
        subtitle={sheetManager?.requestedPlan ? t(PLAN_LABEL_KEY[sheetManager.requestedPlan]) : undefined}
        actions={managerSheetActions}
        onClose={() => setSheetManager(null)}
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

function SiteRow({ site, showDivider, onPress }: { site: AdminSite; showDivider: boolean; onPress: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${site.name}${site.managerName ? `, ${site.managerName}` : ''}`}
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
          {site.name}
        </AppText>
        <AppText numberOfLines={1} variant="caption" muted>
          {site.managerName ?? t('common.unnamedPerson')}
        </AppText>
        <AppText variant="caption" muted style={{ fontSize: 11 }}>
          {t('admin.managers.pending.requestedOn', { date: new Date(site.createdAt).toLocaleDateString(lang) })}
        </AppText>
      </View>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

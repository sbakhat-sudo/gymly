import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChevronRightIcon, DumbbellIcon } from '@/components/icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GeofenceFields, parseGeofenceFields } from '@/components/GeofenceFields';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import {
  adminSetSiteLocation,
  getActiveManagers,
  getSiteGeofence,
  getSites,
  reassignSiteManager,
  setManagerStatus,
  setSitePlan,
  setSiteStatus,
  type AdminManagerOption,
  type AdminSite,
  type SiteApprovalStatus,
  type SitePlan,
} from './admin-api';
import { exportCsv } from './csv-export';

const STATUS_LABEL_KEY: Record<SiteApprovalStatus, TranslationKey> = {
  pending_approval: 'admin.sites.status.pending',
  active: 'admin.sites.status.active',
  suspended: 'admin.sites.status.suspended',
};

const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};
const PLANS: SitePlan[] = ['trial', 'pro', 'business'];

export function AdminSitesScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const sites = useAsync(() => getSites(), []);
  const managers = useAsync(() => getActiveManagers(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [siteQuery, setSiteQuery] = useState('');

  const [sheetFor, setSheetFor] = useState<AdminSite | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [choosingPlan, setChoosingPlan] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ site: AdminSite; manager: AdminManagerOption } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const [editingLocation, setEditingLocation] = useState(false);
  const [geoLat, setGeoLat] = useState('');
  const [geoLng, setGeoLng] = useState('');
  const [geoRadius, setGeoRadius] = useState('150');
  const [savingLocation, setSavingLocation] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState<'saved' | 'error' | 'invalid' | null>(null);

  const filteredSites = (sites.data ?? []).filter((s) => s.name.toLowerCase().includes(siteQuery.trim().toLowerCase()));

  function exportSites(): void {
    if (!sites.data) return;
    void exportCsv(
      'palestre.csv',
      [t('admin.sites.title'), t('admin.sites.table.manager'), t('admin.sites.table.status'), t('admin.sites.table.plan')],
      sites.data.map((s) => [s.name, s.managerName ?? '', t(STATUS_LABEL_KEY[s.approvalStatus]), t(PLAN_LABEL_KEY[s.plan])])
    );
  }

  function openSheet(s: AdminSite): void {
    setSheetFor(s);
    setReassigning(false);
    setChoosingPlan(false);
    setEditingLocation(false);
    setGeoFeedback(null);
    setGeoLat('');
    setGeoLng('');
    setGeoRadius('150');
    getSiteGeofence(s.siteId)
      .then((g) => {
        if (!g) return;
        setGeoLat(String(g.lat));
        setGeoLng(String(g.lng));
        setGeoRadius(String(g.radius));
      })
      .catch(() => undefined);
  }

  function closeSheet(): void {
    setSheetFor(null);
    setReassigning(false);
    setChoosingPlan(false);
    setEditingLocation(false);
  }

  async function saveSiteLocation(site: AdminSite): Promise<void> {
    setGeoFeedback(null);
    const parsed = parseGeofenceFields(geoLat, geoLng, geoRadius);
    if (!parsed) {
      setGeoFeedback('invalid');
      return;
    }
    setSavingLocation(true);
    try {
      await adminSetSiteLocation(site.siteId, parsed.lat, parsed.lng, parsed.radiusM);
      setGeoFeedback('saved');
    } catch {
      setGeoFeedback('error');
    } finally {
      setSavingLocation(false);
    }
  }

  async function changePlan(site: AdminSite, plan: SitePlan): Promise<void> {
    setBusyId(site.siteId);
    try {
      await setSitePlan(site.siteId, plan);
      sites.reload();
      closeSheet();
    } finally {
      setBusyId(null);
    }
  }

  async function act(site: AdminSite, status: SiteApprovalStatus): Promise<void> {
    setBusyId(site.siteId);
    try {
      await setSiteStatus(site.siteId, status);
      sites.reload();
      closeSheet();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReassign(): Promise<void> {
    if (!confirmTarget) return;
    const { site, manager } = confirmTarget;
    setConfirmTarget(null);
    setBusyId(site.siteId);
    try {
      await reassignSiteManager(site.siteId, manager.userId);
      sites.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleManagerStatus(site: AdminSite): Promise<void> {
    setBusyId(site.siteId);
    try {
      await setManagerStatus(site.managerId, site.managerStatus === 'rejected' ? 'active' : 'rejected');
      sites.reload();
      closeSheet();
    } finally {
      setBusyId(null);
    }
  }

  const sheetActions: ActionSheetAction[] = sheetFor
    ? [
        ...(sheetFor.approvalStatus !== 'active' ? [{ label: t('admin.sites.approve'), onPress: () => void act(sheetFor, 'active'), disabled: busyId === sheetFor.siteId }] : []),
        ...(sheetFor.approvalStatus !== 'suspended'
          ? [
              {
                label: t('admin.sites.suspend'),
                destructive: true,
                onPress: () => {
                  closeSheet();
                  setPendingConfirm({
                    title: t('admin.sites.suspend.confirm.title'),
                    message: t('admin.sites.suspend.confirm.body', { site: sheetFor.name }),
                    confirmLabel: t('admin.sites.suspend'),
                    onConfirm: () => void act(sheetFor, 'suspended'),
                  });
                },
                disabled: busyId === sheetFor.siteId,
              },
            ]
          : []),
        { label: t('admin.sites.reassign'), onPress: () => setReassigning(true), disabled: busyId === sheetFor.siteId },
        { label: t('admin.sites.changePlan'), onPress: () => setChoosingPlan(true), disabled: busyId === sheetFor.siteId },
        { label: t('manager.gym.location.title'), onPress: () => setEditingLocation(true), disabled: busyId === sheetFor.siteId },
        {
          label: t(sheetFor.managerStatus === 'rejected' ? 'admin.sites.managerReactivate' : 'admin.sites.managerDeactivate'),
          destructive: sheetFor.managerStatus !== 'rejected',
          onPress: () => {
            if (sheetFor.managerStatus === 'rejected') {
              void toggleManagerStatus(sheetFor);
              return;
            }
            closeSheet();
            setPendingConfirm({
              title: t('admin.sites.managerDeactivate.confirm.title'),
              message: t('admin.sites.managerDeactivate.confirm.body', { manager: sheetFor.managerName ?? t('common.unnamedPerson') }),
              confirmLabel: t('admin.sites.managerDeactivate'),
              onConfirm: () => void toggleManagerStatus(sheetFor),
            });
          },
          disabled: busyId === sheetFor.siteId,
        },
      ]
    : [];

  return (
    <Screen onRefresh={sites.reload} refreshing={sites.loading && sites.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <ScreenHeader icon={DumbbellIcon} label={t('admin.sites.pageTitle')} />
      </View>

      {sites.data ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={siteQuery}
            onChangeText={setSiteQuery}
            placeholder={t('admin.sites.search')}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t('admin.sites.search')}
            autoComplete="off"
            textContentType="none"
            style={{
              flex: 1,
              minHeight: MIN_TAP,
              borderWidth: 1.5,
              borderColor: theme.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              color: theme.text,
              fontSize: 15,
            }}
          />
          <Button label={t('admin.report.export')} variant="secondary" onPress={exportSites} />
        </View>
      ) : null}

      {sites.error ? <Banner title={t('admin.sites.error')} /> : null}
      {sites.data === undefined && sites.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {sites.data && filteredSites.length === 0 ? <Banner message={t('admin.sites.empty')} /> : null}

      {filteredSites.length > 0 ? (
        <View style={{ borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          {filteredSites.map((s, i) => (
            <SiteRow key={s.siteId} site={s} showDivider={i > 0} onPress={() => openSheet(s)} />
          ))}
        </View>
      ) : null}

      <ActionSheet
        visible={sheetFor !== null}
        title={sheetFor?.name ?? ''}
        subtitle={[sheetFor?.chainName, sheetFor?.address].filter(Boolean).join(' · ') || undefined}
        actions={reassigning || choosingPlan || editingLocation ? [] : sheetActions}
        onClose={closeSheet}>
        {sheetFor && reassigning ? (
          <ManagerPicker
            candidates={(managers.data ?? []).filter((m) => m.userId !== sheetFor.managerId)}
            onPick={(manager) => {
              setConfirmTarget({ site: sheetFor, manager });
              closeSheet();
            }}
          />
        ) : null}
        {sheetFor && choosingPlan ? (
          <View style={{ gap: spacing.sm }}>
            {PLANS.map((plan) => (
              <Button
                key={plan}
                label={t(PLAN_LABEL_KEY[plan])}
                variant={plan === sheetFor.plan ? 'invert' : 'secondary'}
                onPress={() => void changePlan(sheetFor, plan)}
                disabled={busyId === sheetFor.siteId}
              />
            ))}
          </View>
        ) : null}
        {sheetFor && editingLocation ? (
          <View style={{ gap: spacing.sm }}>
            <GeofenceFields lat={geoLat} onLatChange={setGeoLat} lng={geoLng} onLngChange={setGeoLng} radiusM={geoRadius} onRadiusChange={setGeoRadius} />
            {geoFeedback ? (
              <View accessibilityLiveRegion="polite">
                <AppText color={geoFeedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
                  {t(geoFeedback === 'saved' ? 'manager.gym.location.saved' : geoFeedback === 'invalid' ? 'manager.gym.location.invalid' : 'manager.gym.location.error')}
                </AppText>
              </View>
            ) : null}
            <Button label={t('manager.gym.location.save')} onPress={() => void saveSiteLocation(sheetFor)} disabled={savingLocation} />
          </View>
        ) : null}
      </ActionSheet>

      <ConfirmDialog
        visible={confirmTarget !== null}
        title={t('admin.sites.reassign.confirm.title')}
        message={confirmTarget ? t('admin.sites.reassign.confirm.body', { site: confirmTarget.site.name, manager: confirmTarget.manager.fullName ?? t('common.unnamedPerson') }) : ''}
        confirmLabel={t('admin.sites.reassign')}
        onConfirm={() => void confirmReassign()}
        onCancel={() => setConfirmTarget(null)}
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

const PLAN_COLOR: Record<SitePlan, (theme: ReturnType<typeof useTheme>) => string> = {
  trial: (theme) => theme.textMuted,
  pro: (theme) => theme.primary,
  business: (theme) => theme.band.amber.solid,
};

function SiteRow({ site, showDivider, onPress }: { site: AdminSite; showDivider: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const statusColor = site.approvalStatus === 'active' ? theme.band.green.solid : site.approvalStatus === 'suspended' ? theme.danger : theme.band.amber.solid;
  const planColor = PLAN_COLOR[site.plan](theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${site.name}, ${t(PLAN_LABEL_KEY[site.plan])}, ${t(STATUS_LABEL_KEY[site.approvalStatus])}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 68,
          paddingHorizontal: spacing.md,
          borderTopWidth: showDivider ? 1 : 0,
          borderTopColor: theme.glassBorder,
          borderLeftWidth: 4,
          borderLeftColor: planColor,
          backgroundColor: pressed ? theme.surfaceAlt : `${planColor}14`,
        },
      ]}>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 15 }}>
          {site.name}
        </AppText>
        <AppText numberOfLines={1} variant="caption" muted>
          {t('admin.sites.managedBy', { name: site.managerName ?? t('common.unnamedPerson') })}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: planColor }}>
            <AppText style={{ fontSize: 10, fontWeight: '800', color: theme.background, textTransform: 'uppercase', letterSpacing: 10 * 0.06 }}>
              {t(PLAN_LABEL_KEY[site.plan])}
            </AppText>
          </View>
          {site.chainName ? (
            <View style={{ flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.border }}>
              <AppText numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted }}>
                {site.chainName}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <AppText variant="caption" style={{ fontWeight: '700', color: statusColor }}>
        {t(STATUS_LABEL_KEY[site.approvalStatus])}
      </AppText>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

function ManagerPicker({ candidates, onPick }: { candidates: AdminManagerOption[]; onPick: (manager: AdminManagerOption) => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const filtered = candidates.filter((m) => (m.fullName ?? '').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={{ gap: spacing.xs }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('admin.sites.reassign.search')}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={t('admin.sites.reassign.search')}
        autoFocus
        autoComplete="off"
        textContentType="none"
        style={{
          minHeight: MIN_TAP,
          borderWidth: 1.5,
          borderColor: theme.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          color: theme.text,
          fontSize: 15,
        }}
      />
      {filtered.length === 0 ? (
        <AppText variant="caption" muted>
          {t('admin.sites.reassign.empty')}
        </AppText>
      ) : (
        filtered.slice(0, 6).map((m) => <Button key={m.userId} label={m.fullName ?? t('common.unnamedPerson')} variant="secondary" onPress={() => onPick(m)} />)
      )}
    </View>
  );
}

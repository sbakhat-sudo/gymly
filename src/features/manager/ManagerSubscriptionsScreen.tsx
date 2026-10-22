import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { ChevronDownIcon, CreditCardIcon, SlidersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { FilterGroup } from '@/components/FilterControls';
import { assignPlan, getManagerClientSubscriptions, type ClientSubscriptionRow, type PlanType, type SubscriptionStatus } from '@/features/billing/billing-api';
import { ManagerNotifications } from '@/features/manager/ManagerNotifications';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

const PAGE_SIZE = 8;
const COL = { name: 1.8, plan: 1, expiry: 1.2, status: 1.2, actions: 1 };

type StatusFilter = 'all' | SubscriptionStatus | 'none';

const STATUS_LABEL_KEY: Record<SubscriptionStatus, TranslationKey> = {
  active: 'manager.subscriptions.status.active',
  grace: 'manager.subscriptions.status.grace',
  blocked: 'manager.subscriptions.status.blocked',
};
const PLAN_LABEL_KEY: Record<PlanType, TranslationKey> = {
  monthly: 'billing.plan.monthly',
  annual: 'billing.plan.annual',
};

/**
 * "Abbonamenti" — same search + status-chip-filter + table shape as `ManagerIssuesScreen.tsx` (not
 * `PeopleScreen.tsx`'s static roster), since that's the closest existing screen to what this needs.
 * A Client with no `subscriptions` row still appears (the RPC LEFT JOINs), shown as "Nessun piano"
 * with an "Assegna piano" action — the only way an existing/grandfathered Client ever gets one.
 */
export function ManagerSubscriptionsScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const rows = useAsync(() => getManagerClientSubscriptions(), []);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ClientSubscriptionRow | null>(null);
  const [assigning, setAssigning] = useState(false);

  const queryLower = query.trim().toLowerCase();
  const filtered = (rows.data ?? []).filter((r) => {
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'none' ? r.status === null : r.status === statusFilter);
    const matchesQuery = !queryLower || (r.fullName ?? '').toLowerCase().includes(queryLower);
    return matchesStatus && matchesQuery;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilter<T>(setter: (v: T) => void, value: T): void {
    setter(value);
    setPage(0);
  }

  async function assign(plan: PlanType): Promise<void> {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await assignPlan(assignTarget.clientId, plan);
      setAssignTarget(null);
      rows.reload();
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Screen onRefresh={rows.reload} refreshing={rows.loading && rows.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={CreditCardIcon} label={t('manager.subscriptions.title')} notifications={<ManagerNotifications />} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm }}>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('manager.subscriptions.filters')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: theme.border }}>
          <SlidersIcon color={theme.textMuted} size={15} />
          <AppText style={{ fontSize: 13, fontWeight: '700' }}>
            {t('manager.subscriptions.filters')}
            {statusFilter !== 'all' ? ' (1)' : ''}
          </AppText>
          <ChevronDownIcon color={theme.textMuted} size={14} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder={t('manager.subscriptions.search')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('manager.subscriptions.search')}
          autoComplete="off"
          textContentType="none"
          style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, maxWidth: 320, height: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontSize: 14 }}
        />
      </View>

      <ActionSheet visible={filtersOpen} title={t('manager.subscriptions.filters')} actions={[]} onClose={() => setFiltersOpen(false)}>
        <FilterGroup
          label={t('manager.subscriptions.filterStatus')}
          value={statusFilter}
          options={[
            { value: 'all' as const, label: t('manager.feedback.filterAll') },
            { value: 'active' as const, label: t('manager.subscriptions.status.active') },
            { value: 'grace' as const, label: t('manager.subscriptions.status.grace') },
            { value: 'blocked' as const, label: t('manager.subscriptions.status.blocked') },
            { value: 'none' as const, label: t('manager.subscriptions.status.none') },
          ]}
          onChange={(v) => resetFilter(setStatusFilter, v)}
        />
      </ActionSheet>

      {rows.error ? <Banner title={t('manager.subscriptions.error')} /> : null}
      {rows.data === undefined && rows.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {rows.data && filtered.length === 0 ? <Banner message={t('manager.subscriptions.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ width: '100%', borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
            <HeaderCell flex={COL.name} label={t('manager.subscriptions.col.name')} />
            <HeaderCell flex={COL.plan} label={t('manager.subscriptions.col.plan')} />
            <HeaderCell flex={COL.expiry} label={t('manager.subscriptions.col.expiry')} />
            <HeaderCell flex={COL.status} label={t('manager.subscriptions.col.status')} />
            <HeaderCell flex={COL.actions} label={t('manager.subscriptions.col.actions')} align="right" />
          </View>
          {pageRows.map((row, i) => (
            <SubscriptionRow key={row.clientId} row={row} showDivider={i > 0} onAssign={() => setAssignTarget(row)} />
          ))}
        </View>
      ) : null}

      {filtered.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {t('manager.subscriptions.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
          </AppText>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('manager.subscriptions.nextPage')} />
        </View>
      ) : null}

      <ActionSheet
        visible={assignTarget !== null}
        title={t('manager.subscriptions.assign.title')}
        subtitle={assignTarget?.fullName ?? undefined}
        onClose={() => setAssignTarget(null)}
        actions={[
          { label: t('billing.plan.monthly'), onPress: () => void assign('monthly'), disabled: assigning },
          { label: t('billing.plan.annual'), onPress: () => void assign('annual'), disabled: assigning },
        ]}
      />
    </Screen>
  );
}

function StatusPill({ status }: { status: SubscriptionStatus | null }) {
  const { t } = useI18n();
  const theme = useTheme();
  if (status === null) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
        <AppText variant="caption" style={{ fontSize: 11, fontWeight: '700' }}>
          {t('manager.subscriptions.status.none')}
        </AppText>
      </View>
    );
  }
  const band = status === 'active' ? theme.band.green : status === 'grace' ? theme.band.amber : theme.band.red;
  return (
    <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: band.soft }}>
      <AppText style={{ color: band.onSoft, fontSize: 11, fontWeight: '700' }}>{t(STATUS_LABEL_KEY[status])}</AppText>
    </View>
  );
}

function SubscriptionRow({ row, showDivider, onAssign }: { row: ClientSubscriptionRow; showDivider: boolean; onAssign: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm, borderTopWidth: showDivider ? 1 : 0, borderTopColor: theme.glassBorder }}>
      <View style={{ flex: COL.name, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar uri={null} name={row.fullName} size={28} tint={avatarTint(theme, row.fullName ?? '?')} />
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, flexShrink: 1 }}>
          {row.fullName || t('common.unnamedPerson')}
        </AppText>
      </View>
      <View style={{ flex: COL.plan }}>
        <AppText style={{ fontSize: 13 }}>{row.planType ? t(PLAN_LABEL_KEY[row.planType]) : '—'}</AppText>
      </View>
      <View style={{ flex: COL.expiry }}>
        <AppText style={{ fontSize: 13 }}>{row.expiryDate ? new Date(`${row.expiryDate}T00:00:00`).toLocaleDateString(lang) : '—'}</AppText>
      </View>
      <View style={{ flex: COL.status }}>
        <StatusPill status={row.status} />
      </View>
      <View style={{ flex: COL.actions, alignItems: 'flex-end' }}>
        {row.status === null ? (
          <Pressable onPress={onAssign} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: theme.primary }}>
            <AppText style={{ color: theme.onPrimary, fontSize: 12, fontWeight: '700' }}>{t('manager.subscriptions.assign.button')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

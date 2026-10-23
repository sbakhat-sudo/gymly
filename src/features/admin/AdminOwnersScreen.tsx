import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LayersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getOwners, markOwnerPaid, setOwnerStatus, type AdminOwnerRow, type OwnerPlanStatus, type SitePlan } from './admin-api';

const PAGE_SIZE = 10;
const COL = { name: 1.6, chain: 1.4, plan: 0.9, payment: 1.3, managers: 0.9, actions: 1 };

const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
};

const PAYMENT_LABEL_KEY: Record<OwnerPlanStatus, TranslationKey> = {
  active: 'admin.owners.payment.active',
  grace: 'admin.owners.payment.grace',
  deactivated: 'admin.owners.payment.deactivated',
};

/** Every already-approved Owner, with the one thing Admin had no way to see before: how many
 * Managers (gyms) their chain actually has. Pending Owners stay on "Richieste" — this is the roster
 * of ones already running. */
export function AdminOwnersScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const owners = useAsync(() => getOwners(), []);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminOwnerRow | null>(null);
  const [confirming, setConfirming] = useState<AdminOwnerRow | null>(null);
  const [deactivating, setDeactivating] = useState<AdminOwnerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(false);
    try {
      await action();
      owners.reload();
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
      setConfirming(null);
      setDeactivating(null);
    }
  }

  // What Admin can do depends on why the Owner is off: one the billing job deactivated comes back only
  // by recording a payment (that also resets the billing state), one Admin switched off by hand can
  // simply be switched back on.
  function actionsFor(owner: AdminOwnerRow) {
    const pay = {
      label: t('admin.owners.payment.markPaid'),
      onPress: () => {
        setConfirming(owner);
        setSelected(null);
      },
    };
    if (owner.planStatus === 'deactivated') return [pay];
    if (owner.status === 'rejected') {
      return [
        {
          label: t('admin.owners.action.reactivate'),
          onPress: () => {
            setSelected(null);
            void run(() => setOwnerStatus(owner.ownerId, 'active'));
          },
        },
        pay,
      ];
    }
    return [
      pay,
      {
        label: t('admin.owners.action.deactivate'),
        destructive: true,
        onPress: () => {
          setDeactivating(owner);
          setSelected(null);
        },
      },
    ];
  }

  const queryLower = query.trim().toLowerCase();
  const filtered = (owners.data ?? []).filter(
    (o) => !queryLower || (o.fullName ?? '').toLowerCase().includes(queryLower) || (o.chainName ?? '').toLowerCase().includes(queryLower)
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <Screen onRefresh={owners.reload} refreshing={owners.loading && owners.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={LayersIcon} label={t('admin.owners.title')} />
      </View>

      <TextInput
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setPage(0);
        }}
        placeholder={t('admin.owners.search')}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={t('admin.owners.search')}
        autoComplete="off"
        textContentType="none"
        style={{ height: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontSize: 14 }}
      />

      {owners.error ? <Banner title={t('admin.owners.error')} /> : null}
      {actionError ? <Banner title={t('admin.owners.payment.error')} /> : null}
      {owners.data === undefined && owners.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {owners.data && filtered.length === 0 ? <Banner message={t('admin.owners.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ width: '100%', borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
            <HeaderCell flex={COL.name} label={t('admin.owners.col.name')} />
            <HeaderCell flex={COL.chain} label={t('admin.owners.col.chain')} />
            <HeaderCell flex={COL.plan} label={t('admin.owners.col.plan')} />
            <HeaderCell flex={COL.payment} label={t('admin.owners.col.payment')} />
            <HeaderCell flex={COL.managers} label={t('admin.owners.col.managers')} align="right" />
            <HeaderCell flex={COL.actions} label={t('admin.owners.col.actions')} align="right" />
          </View>
          {pageRows.map((row, i) => (
            <OwnerRow key={row.ownerId} row={row} showDivider={i > 0} onActions={() => setSelected(row)} />
          ))}
        </View>
      ) : null}

      <ActionSheet
        visible={selected !== null}
        title={selected?.fullName || t('common.unnamedPerson')}
        subtitle={selected?.chainName ?? undefined}
        actions={selected ? actionsFor(selected) : []}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        visible={confirming !== null}
        title={t('admin.owners.payment.confirm.title')}
        message={t('admin.owners.payment.confirm.body', { owner: confirming?.fullName || t('common.unnamedPerson') })}
        confirmLabel={t('admin.owners.payment.markPaid')}
        onConfirm={() => {
          if (confirming && !busy) void run(() => markOwnerPaid(confirming.ownerId));
        }}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        visible={deactivating !== null}
        destructive
        title={t('admin.owners.deactivate.confirm.title')}
        message={t('admin.owners.deactivate.confirm.body', { owner: deactivating?.fullName || t('common.unnamedPerson') })}
        confirmLabel={t('admin.owners.action.deactivate')}
        onConfirm={() => {
          if (deactivating && !busy) void run(() => setOwnerStatus(deactivating.ownerId, 'rejected'));
        }}
        onCancel={() => setDeactivating(null)}
      />

      {filtered.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {t('admin.owners.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
          </AppText>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('admin.owners.nextPage')} />
        </View>
      ) : null}
    </Screen>
  );
}

function OwnerRow({ row, showDivider, onActions }: { row: AdminOwnerRow; showDivider: boolean; onActions: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  // Grace shows its own deadline (the moment the Owner is switched off); otherwise the paid-until date.
  const paymentDate = row.planStatus === 'grace' ? row.planGraceEnd : row.planStatus === 'active' ? row.planPaidUntil : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm, borderTopWidth: showDivider ? 1 : 0, borderTopColor: theme.glassBorder }}>
      <View style={{ flex: COL.name, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar uri={null} name={row.fullName} size={28} tint={avatarTint(theme, row.fullName ?? row.email)} />
        <View style={{ flexShrink: 1 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5 }}>
            {row.fullName || t('common.unnamedPerson')}
          </AppText>
          <AppText numberOfLines={1} variant="caption" muted>
            {row.email}
          </AppText>
        </View>
      </View>
      <View style={{ flex: COL.chain }}>
        <AppText numberOfLines={1} style={{ fontSize: 13 }}>
          {row.chainName ?? '—'}
        </AppText>
      </View>
      <View style={{ flex: COL.plan }}>
        <AppText style={{ fontSize: 13 }}>{row.plan ? t(PLAN_LABEL_KEY[row.plan]) : '—'}</AppText>
      </View>
      <View style={{ flex: COL.payment }}>
        <AppText style={{ fontSize: 13, fontWeight: '700' }}>{row.planStatus ? t(PAYMENT_LABEL_KEY[row.planStatus]) : '—'}</AppText>
        {paymentDate ? (
          <AppText variant="caption" muted>
            {new Date(paymentDate).toLocaleDateString(lang)}
          </AppText>
        ) : null}
      </View>
      <View style={{ flex: COL.managers, alignItems: 'flex-end' }}>
        <AppText style={{ fontSize: 13, fontWeight: '700' }}>{row.managersCount}</AppText>
      </View>
      <View style={{ flex: COL.actions, alignItems: 'flex-end' }}>
        <Pressable
          onPress={onActions}
          accessibilityRole="button"
          accessibilityLabel={`${t('admin.owners.col.actions')}: ${row.fullName || row.email}`}
          style={{ minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
          <AppText style={{ fontSize: 13, fontWeight: '700' }}>{t('admin.owners.col.actions')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

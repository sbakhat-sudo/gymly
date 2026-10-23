import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { LayersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getOwners, type AdminOwnerRow, type SitePlan } from './admin-api';

const PAGE_SIZE = 10;
const COL = { name: 1.6, chain: 1.4, plan: 0.9, managers: 1 };

const PLAN_LABEL_KEY: Record<SitePlan, TranslationKey> = {
  trial: 'admin.sites.plan.trial',
  pro: 'admin.sites.plan.pro',
  business: 'admin.sites.plan.business',
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
      {owners.data === undefined && owners.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {owners.data && filtered.length === 0 ? <Banner message={t('admin.owners.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ width: '100%', borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
            <HeaderCell flex={COL.name} label={t('admin.owners.col.name')} />
            <HeaderCell flex={COL.chain} label={t('admin.owners.col.chain')} />
            <HeaderCell flex={COL.plan} label={t('admin.owners.col.plan')} />
            <HeaderCell flex={COL.managers} label={t('admin.owners.col.managers')} align="right" />
          </View>
          {pageRows.map((row, i) => (
            <OwnerRow key={row.ownerId} row={row} showDivider={i > 0} />
          ))}
        </View>
      ) : null}

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

function OwnerRow({ row, showDivider }: { row: AdminOwnerRow; showDivider: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm, borderTopWidth: showDivider ? 1 : 0, borderTopColor: theme.glassBorder }}>
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
      <View style={{ flex: COL.managers, alignItems: 'flex-end' }}>
        <AppText style={{ fontSize: 13, fontWeight: '700' }}>{row.managersCount}</AppText>
      </View>
    </View>
  );
}

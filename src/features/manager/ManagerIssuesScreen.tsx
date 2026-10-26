import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { DateBadge } from '@/components/DateBadge';
import { FilterGroup } from '@/components/FilterControls';
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, ClockIcon, DownloadIcon, EyeIcon, SlidersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type Lang, type TranslationKey } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { ManagerNotifications } from './ManagerNotifications';
import { getIssues, reopenIssue, resolveIssue, setIssueSeverity, type IssueSeverity, type IssueStatus, type ManagerIssueEntry } from './manager-api';

const STATUS_LABEL_KEY: Record<IssueStatus, TranslationKey> = {
  pending: 'manager.issues.status.pending',
  resolved: 'manager.issues.status.resolved',
};
const SEVERITY_LABEL_KEY: Record<IssueSeverity, TranslationKey> = {
  urgent: 'manager.issues.severity.urgent',
  minor: 'manager.issues.severity.minor',
};

type StatusFilter = 'all' | IssueStatus;
type SeverityFilter = 'all' | IssueSeverity;

const PAGE_SIZE = 6;
/** Column widths as flex ratios — kept as one table, shared by the header row and every body row, so
 * they can never drift out of alignment with each other. */
const COL = { date: 0.9, client: 1.9, issue: 2.3, severity: 1, status: 1.15, actions: 0.8 };

function escapeCsvCell(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

/**
 * No reply field anywhere on this screen, by design (spec: "senza campo di risposta testuale") —
 * the Manager sets severity and resolves, nothing that reaches the Client.
 */
export function ManagerIssuesScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const issues = useAsync(() => getIssues(), []);
  const { dateKey } = useSelectedDate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (severityFilter !== 'all' ? 1 : 0);

  // Scoped to the day picked from the top-bar date badge (defaults to today) — "cosa è successo
  // [quel giorno]", the same reported-at day the table's own DATA column already shows.
  const dayIssues = (issues.data ?? []).filter((i) => isOnDateKey(i.createdAt, dateKey));
  const queryLower = query.trim().toLowerCase();
  const filtered = dayIssues.filter(
    (i) =>
      (statusFilter === 'all' || i.status === statusFilter) &&
      (severityFilter === 'all' || i.severity === severityFilter) &&
      (!queryLower || (i.clientName ?? '').toLowerCase().includes(queryLower) || (i.description ?? '').toLowerCase().includes(queryLower))
  );
  const totalCount = dayIssues.length;
  const pendingCount = dayIssues.filter((i) => i.status === 'pending').length;
  const resolvedCount = dayIssues.filter((i) => i.status === 'resolved').length;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilter<T>(setter: (v: T) => void, value: T): void {
    setter(value);
    setPage(0);
  }

  async function setSeverity(id: number, severity: IssueSeverity): Promise<void> {
    setBusyId(id);
    try {
      await setIssueSeverity(id, severity);
      issues.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(id: number): Promise<void> {
    setBusyId(id);
    try {
      await resolveIssue(id);
      issues.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function reopen(id: number): Promise<void> {
    setBusyId(id);
    try {
      await reopenIssue(id);
      issues.reload();
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv(): void {
    const header = [
      t('manager.issues.col.date'),
      t('manager.issues.col.client'),
      t('manager.issues.col.issue'),
      t('manager.issues.col.severity'),
      t('manager.issues.col.status'),
    ];
    const rows = filtered.map((i) => [
      new Date(i.createdAt).toLocaleDateString(lang),
      i.clientName || t('common.unnamedPerson'),
      i.description ?? '',
      i.severity ? t(SEVERITY_LABEL_KEY[i.severity]) : '',
      t(STATUS_LABEL_KEY[i.status]),
    ]);
    const csv = '﻿' + [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('manager.issues.title').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen onRefresh={issues.reload} refreshing={issues.loading && issues.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={AlertTriangleIcon} label={t('manager.issues.title')} notifications={<ManagerNotifications />} />
      </View>

      {issues.data ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IssueStatCard icon={AlertTriangleIcon} tint={theme.danger} label={t('manager.issues.stat.total')} value={totalCount} />
          <IssueStatCard icon={ClockIcon} tint={theme.band.amber.solid} label={t('manager.issues.stat.pending')} value={pendingCount} />
          <IssueStatCard icon={CheckIcon} tint={theme.band.green.solid} label={t('manager.issues.stat.resolved')} value={resolvedCount} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm }}>
        <DateBadge />
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('manager.issues.filters')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: MIN_TAP,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: theme.border,
          }}>
          <SlidersIcon color={theme.textMuted} size={15} />
          <AppText style={{ fontSize: 13, fontWeight: '700' }}>
            {t('manager.issues.filters')}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </AppText>
          <ChevronDownIcon color={theme.textMuted} size={14} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder={t('manager.issues.search')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('manager.issues.search')}
          autoComplete="off"
          textContentType="none"
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 200,
            maxWidth: 320,
            height: MIN_TAP,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            color: theme.text,
            fontSize: 14,
          }}
        />
        <Pressable
          onPress={exportCsv}
          disabled={filtered.length === 0}
          accessibilityRole="button"
          accessibilityLabel={t('manager.issues.export')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: MIN_TAP,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: theme.border,
            opacity: filtered.length === 0 ? 0.5 : 1,
          }}>
          <DownloadIcon color={theme.text} size={16} />
          <AppText style={{ fontSize: 13, fontWeight: '700' }}>{t('manager.issues.export')}</AppText>
        </Pressable>
      </View>

      <ActionSheet visible={filtersOpen} title={t('manager.issues.filters')} actions={[]} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <FilterGroup
            label={t('manager.issues.filterStatus')}
            value={statusFilter}
            options={[
              { value: 'all' as const, label: t('manager.feedback.filterAll') },
              { value: 'pending' as const, label: t('manager.issues.status.pending') },
              { value: 'resolved' as const, label: t('manager.issues.status.resolved') },
            ]}
            onChange={(v) => resetFilter(setStatusFilter, v)}
          />
          <FilterGroup
            label={t('manager.issues.filterSeverity')}
            value={severityFilter}
            options={[
              { value: 'all' as const, label: t('manager.feedback.filterAll') },
              { value: 'urgent' as const, label: t('manager.issues.severity.urgent') },
              { value: 'minor' as const, label: t('manager.issues.severity.minor') },
            ]}
            onChange={(v) => resetFilter(setSeverityFilter, v)}
          />
        </View>
      </ActionSheet>

      {issues.error ? <Banner title={t('manager.issues.error')} /> : null}
      {issues.data === undefined && issues.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {issues.data && filtered.length === 0 ? <EmptyState message={t('manager.issues.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ width: '100%', borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
            <HeaderCell flex={COL.date} label={t('manager.issues.col.date')} sortable />
            <HeaderCell flex={COL.client} label={t('manager.issues.col.client')} />
            <HeaderCell flex={COL.issue} label={t('manager.issues.col.issue')} />
            <HeaderCell flex={COL.severity} label={t('manager.issues.col.severity')} />
            <HeaderCell flex={COL.status} label={t('manager.issues.col.status')} />
            <HeaderCell flex={COL.actions} label={t('manager.issues.col.actions')} align="right" />
          </View>

          {pageRows.map((issue, i) => (
            <IssueTableRow
              key={issue.id}
              issue={issue}
              showDivider={i > 0}
              busy={busyId === issue.id}
              onSetSeverity={(s) => void setSeverity(issue.id, s)}
              onResolve={() => void resolve(issue.id)}
              onReopen={() => void reopen(issue.id)}
              lang={lang}
            />
          ))}
        </View>
      ) : null}

      {filtered.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {t('manager.issues.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
          </AppText>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('manager.issues.nextPage')} />
        </View>
      ) : null}
    </Screen>
  );
}

type IconType = (p: { color: string; size: number }) => React.ReactElement;

function IssueStatCard({ icon: Icon, tint, label, value }: { icon: IconType; tint: string; label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, padding: spacing.md, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}22` }}>
          <Icon color={tint} size={12} />
        </View>
        <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </AppText>
      </View>
      <AppText style={{ fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</AppText>
    </View>
  );
}

function IssueTableRow({
  issue,
  showDivider,
  busy,
  onSetSeverity,
  onResolve,
  onReopen,
  lang,
}: {
  issue: ManagerIssueEntry;
  showDivider: boolean;
  busy: boolean;
  onSetSeverity: (s: IssueSeverity) => void;
  onResolve: () => void;
  onReopen: () => void;
  lang: Lang;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const statusColor = issue.status === 'resolved' ? theme.band.green.solid : theme.band.amber.solid;
  const severityColor = issue.severity === 'urgent' ? theme.danger : theme.textMuted;
  const clientLabel = issue.clientName || t('common.unnamedPerson');

  // Severity can be changed at any time, pending or already resolved (correcting a mistake); only
  // the resolve/reopen pair depends on the current status — "Azioni" always has something to do,
  // never an empty menu once an issue is closed.
  const actions: ActionSheetAction[] = [
    { label: t('manager.issues.setUrgent'), onPress: () => { setMenuOpen(false); onSetSeverity('urgent'); } },
    { label: t('manager.issues.setMinor'), onPress: () => { setMenuOpen(false); onSetSeverity('minor'); } },
    issue.status === 'pending'
      ? { label: t('manager.issues.resolve'), onPress: () => { setMenuOpen(false); onResolve(); } }
      : { label: t('manager.issues.reopen'), onPress: () => { setMenuOpen(false); onReopen(); } },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm, borderTopWidth: showDivider ? 1 : 0, borderTopColor: theme.glassBorder, opacity: busy ? 0.6 : 1 }}>
      <View style={{ flex: COL.date }}>
        <AppText variant="caption" muted style={{ fontSize: 12.5 }}>
          {new Date(issue.createdAt).toLocaleDateString(lang)}
        </AppText>
      </View>

      <View style={{ flex: COL.client, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar uri={issue.clientAvatarUrl} name={issue.clientName} size={28} tint={avatarTint(theme, clientLabel)} />
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, flexShrink: 1 }}>
          {clientLabel}
        </AppText>
      </View>

      <View style={{ flex: COL.issue }}>
        <AppText numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
          {issue.description || '—'}
        </AppText>
      </View>

      <View style={{ flex: COL.severity }}>
        {issue.severity ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: severityColor }} />
            <AppText color={severityColor} style={{ fontSize: 12, fontWeight: '700' }}>
              {t(SEVERITY_LABEL_KEY[issue.severity])}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" muted style={{ fontSize: 12 }}>
            —
          </AppText>
        )}
      </View>

      <View style={{ flex: COL.status }}>
        <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: `${statusColor}22` }}>
          <AppText color={statusColor} style={{ fontSize: 11, fontWeight: '800' }}>
            {t(STATUS_LABEL_KEY[issue.status])}
          </AppText>
        </View>
      </View>

      <View style={{ flex: COL.actions, alignItems: 'flex-end', paddingRight: 2 }}>
        <Pressable
          onPress={() => setMenuOpen(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('manager.issues.rowActions')}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1,
          })}>
          <EyeIcon color={theme.text} size={17} />
        </Pressable>
      </View>

      <ActionSheet visible={menuOpen} title={clientLabel} subtitle={issue.description ?? undefined} actions={actions} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { DateBadge } from '@/components/DateBadge';
import { FilterGroup } from '@/components/FilterControls';
import { CheckIcon, DownloadIcon, EyeIcon, SearchIcon, SlidersIcon, StarFilledIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StarRatingDisplay } from '@/components/StarRating';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { formatDayLabel } from '@/lib/format';
import { useI18n, type Lang } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { ManagerNotifications } from './ManagerNotifications';
import { getRatings, type ManagerRatingEntry } from './manager-api';

type CoachFilter = 'all' | string;
type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';

const PAGE_SIZE = 8;
/** Column widths as flex ratios — kept as one table, shared by the header row and every body row, so
 * they can never drift out of alignment with each other (same pattern as `ManagerIssuesScreen`). */
const COL = { date: 0.8, client: 1.7, coach: 1.1, rating: 0.9, comment: 2.6, actions: 1.5 };

const SORT_LABEL_KEY = {
  recent: 'manager.feedback.sortRecent',
  oldest: 'manager.feedback.sortOldest',
  highest: 'manager.feedback.sortHighest',
  lowest: 'manager.feedback.sortLowest',
} as const;

function escapeCsvCell(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

/** Read-only on the rating itself — the Manager's only write here is a note FOR the Coach. There is
 * no field, button, or RPC anywhere in this screen that reaches the Client. One row per rating in a
 * sortable, paginated table (icon, avatar+name, status pill) — the same shape as every other
 * Manager list table (`ManagerIssuesScreen`, `RequestsScreen`) — instead of the earlier one-card-
 * per-coach layout, so "quanti sono stati risposti" reads at a glance across every coach at once. */
export function ManagerFeedbackScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const ratings = useAsync(() => getRatings(), []);
  const { dateKey } = useSelectedDate();
  const [query, setQuery] = useState('');
  const [coachFilter, setCoachFilter] = useState<CoachFilter>('all');
  const [minStars, setMinStars] = useState(0);
  const [sort, setSort] = useState<SortOrder>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const coachOptions = [...new Map((ratings.data ?? []).map((r) => [r.coachId, r.coachName])).entries()].map(([id, name]) => ({
    id,
    name: name || t('common.unnamedPerson'),
  }));

  const queryLower = query.trim().toLowerCase();
  // Scoped to the day picked from the top-bar date badge (defaults to every date).
  const filtered = (ratings.data ?? [])
    .filter(
      (r) =>
        isOnDateKey(r.createdAt, dateKey) &&
        (coachFilter === 'all' || r.coachId === coachFilter) &&
        r.rating >= minStars &&
        (!queryLower || (r.coachName ?? '').toLowerCase().includes(queryLower) || (r.comment ?? '').toLowerCase().includes(queryLower))
    )
    .sort((a, b) => {
      if (sort === 'highest') return b.rating - a.rating;
      if (sort === 'lowest') return a.rating - b.rating;
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === 'oldest' ? diff : -diff;
    });

  const detailEntry = filtered.find((r) => r.id === detailId) ?? null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilter<T>(setter: (v: T) => void, value: T): void {
    setter(value);
    setPage(0);
  }

  function exportCsv(): void {
    const header = [
      t('manager.feedback.col.date'),
      t('manager.feedback.col.client'),
      t('manager.feedback.col.coach'),
      t('manager.feedback.col.rating'),
      t('manager.feedback.col.comment'),
    ];
    const rows = filtered.map((r) => [
      new Date(r.createdAt).toLocaleDateString(lang),
      r.clientName || t('common.unnamedPerson'),
      r.coachName || t('common.unnamedPerson'),
      String(r.rating),
      r.comment ?? '',
    ]);
    const csv = '﻿' + [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('manager.feedback.title').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen onRefresh={ratings.reload} refreshing={ratings.loading && ratings.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={StarFilledIcon} label={t('manager.feedback.title')} notifications={<ManagerNotifications />} />
      </View>

      {/* One big "glass" card wrapping the whole list — search/filters/export, the table, and
          pagination — instead of those floating loose on the bare page background. */}
      <View style={[{ borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.glassBorder, padding: spacing.lg, gap: spacing.md }, CARD_SHADOW]}>
        <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
          {t('manager.feedback.subtitle')}
        </AppText>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <DateBadge />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              height: MIN_TAP,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: theme.border,
              minWidth: 160,
            }}>
            <SearchIcon color={theme.textMuted} size={17} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setPage(0);
              }}
              placeholder={t('manager.feedback.filterCoach')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('manager.feedback.filterCoach')}
              autoComplete="off"
              textContentType="none"
              style={{ flex: 1, color: theme.text, fontSize: 14 }}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('manager.feedback.filters')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: MIN_TAP,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: theme.border,
            }}>
            <SlidersIcon color={theme.textMuted} size={15} />
            <AppText style={{ fontSize: 13, fontWeight: '700' }}>{t('manager.feedback.filters')}</AppText>
          </Pressable>
          <Pressable
            onPress={exportCsv}
            disabled={filtered.length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('manager.feedback.export')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: MIN_TAP,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: theme.text,
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}>
            <DownloadIcon color={theme.background} size={16} />
            <AppText color={theme.background} style={{ fontWeight: '700', fontSize: 13 }}>
              {t('manager.feedback.export')}
            </AppText>
          </Pressable>
        </View>

        {ratings.error ? <Banner title={t('manager.feedback.error')} /> : null}
        {ratings.data === undefined && ratings.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
        {ratings.data && filtered.length === 0 ? <Banner message={t('manager.feedback.empty')} /> : null}

        {pageRows.length > 0 ? (
          <View style={{ width: '100%', borderRadius: radius.lg, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
              <HeaderCell flex={COL.date} label={t('manager.feedback.col.date')} />
              <HeaderCell flex={COL.client} label={t('manager.feedback.col.client')} />
              <HeaderCell flex={COL.coach} label={t('manager.feedback.col.coach')} />
              <HeaderCell flex={COL.rating} label={t('manager.feedback.col.rating')} />
              <HeaderCell flex={COL.comment} label={t('manager.feedback.col.comment')} />
              <HeaderCell flex={COL.actions} label={t('manager.feedback.col.actions')} align="right" />
            </View>

            {pageRows.map((entry, i) => (
              <FeedbackTableRow key={entry.id} entry={entry} showDivider={i > 0} lang={lang} onOpen={() => setDetailId(entry.id)} />
            ))}
          </View>
        ) : null}

        {filtered.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <AppText variant="caption" muted>
              {t('manager.feedback.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
            </AppText>
            <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('manager.feedback.nextPage')} />
          </View>
        ) : null}
      </View>

      <ActionSheet visible={filtersOpen} title={t('manager.feedback.filters')} actions={[]} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <FilterGroup
            label={t('manager.feedback.filterCoachLabel')}
            value={coachFilter}
            options={[{ value: 'all' as const, label: t('manager.feedback.filterAll') }, ...coachOptions.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(v) => resetFilter(setCoachFilter, v)}
          />
          <FilterGroup
            label={t('manager.feedback.filterMinStars')}
            value={minStars}
            options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? t('manager.feedback.filterAll') : `${n}+` }))}
            onChange={(v) => resetFilter(setMinStars, v)}
          />
          <FilterGroup
            label={t('manager.feedback.sortLabel')}
            value={sort}
            options={(['recent', 'oldest', 'highest', 'lowest'] as const).map((s) => ({ value: s, label: t(SORT_LABEL_KEY[s]) }))}
            onChange={(v) => resetFilter(setSort, v)}
          />
        </View>
      </ActionSheet>

      <FeedbackDetailSheet entry={detailEntry} onClose={() => setDetailId(null)} lang={lang} />
    </Screen>
  );
}

function FeedbackTableRow({ entry, showDivider, lang, onOpen }: { entry: ManagerRatingEntry; showDivider: boolean; lang: Lang; onOpen: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const clientLabel = entry.clientName || t('common.unnamedPerson');
  const coachLabel = entry.coachName || t('common.unnamedPerson');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('manager.feedback.rowActions')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        gap: spacing.sm,
        borderTopWidth: showDivider ? 1 : 0,
        borderTopColor: theme.glassBorder,
        backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
      })}>
      <View style={{ flex: COL.date }}>
        <AppText variant="caption" muted style={{ fontSize: 12.5 }}>
          {new Date(entry.createdAt).toLocaleDateString(lang)}
        </AppText>
      </View>

      <View style={{ flex: COL.client, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar uri={null} name={clientLabel} size={28} tint={avatarTint(theme, clientLabel)} />
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, flexShrink: 1 }}>
          {clientLabel}
        </AppText>
      </View>

      <View style={{ flex: COL.coach }}>
        <AppText numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>
          {coachLabel}
        </AppText>
      </View>

      <View style={{ flex: COL.rating }}>
        <StarRatingDisplay value={entry.rating} size={13} />
      </View>

      <View style={{ flex: COL.comment }}>
        <AppText numberOfLines={1} muted style={{ fontSize: 13 }}>
          {entry.comment || '—'}
        </AppText>
      </View>

      <View style={{ flex: COL.actions, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 2 }}>
        {entry.coachReply ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
            <CheckIcon color={theme.band.green.solid} size={13} />
            <AppText numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: theme.band.green.solid, flexShrink: 1 }}>
              {coachLabel}
            </AppText>
          </View>
        ) : null}
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
          <EyeIcon color={theme.text} size={17} />
        </View>
      </View>
    </Pressable>
  );
}

/** Read-only: the Manager only watches what happened between the Client and the Coach — the full
 * comment and the Coach's reply, if any. No composer, no edit, no write of any kind here; that's
 * what makes `manager.feedback.status.*` trustworthy as "did the Coach reply", not "did the Manager
 * touch this row". Too much for a table cell, so tapping "Azioni" opens it here instead, same shell
 * as every other sheet in the app (`ActionSheet`). */
function FeedbackDetailSheet({ entry, onClose, lang }: { entry: ManagerRatingEntry | null; onClose: () => void; lang: Lang }) {
  const { t } = useI18n();
  const theme = useTheme();

  if (!entry) return <ActionSheet visible={false} title="" actions={[]} onClose={onClose} />;
  const clientLabel = entry.clientName || t('common.unnamedPerson');

  return (
    <ActionSheet visible title={t('manager.feedback.fromClient', { name: clientLabel })} actions={[]} onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="caption" muted>
            {formatDayLabel(lang, entry.createdAt)} • {entry.coachName || t('common.unnamedPerson')}
          </AppText>
          <StarRatingDisplay value={entry.rating} size={16} />
        </View>

        {entry.comment ? <AppText style={{ fontSize: 14, lineHeight: 19 }}>{entry.comment}</AppText> : null}

        {entry.coachReply ? (
          <View style={{ gap: 2 }}>
            <AppText style={{ color: theme.band.green.solid, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 11 * 0.06 }}>
              {t('manager.feedback.replyTag')}
            </AppText>
            <AppText style={{ fontSize: 14, lineHeight: 19 }}>{entry.coachReply}</AppText>
          </View>
        ) : (
          <AppText variant="caption" muted>
            {t('manager.feedback.status.notReplied')}
          </AppText>
        )}
      </View>
    </ActionSheet>
  );
}

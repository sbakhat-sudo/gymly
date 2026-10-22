import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { DateBadge } from '@/components/DateBadge';
import { FilterChip, FilterGroup } from '@/components/FilterControls';
import { EyeIcon, SearchIcon, SlidersIcon, StarFilledIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StarRatingDisplay } from '@/components/StarRating';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n, type Lang } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { CoachNotifications } from './CoachNotifications';
import { getMyRatings, replyToRating, type CoachRatingEntry } from './coach-api';

type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';

const PAGE_SIZE = 8;
const COL = { date: 0.9, client: 2, rating: 1, comment: 2.6, status: 1.2, actions: 0.7 };

const SORT_LABEL_KEY = {
  recent: 'coach.feedback.sortRecent',
  oldest: 'coach.feedback.sortOldest',
  highest: 'coach.feedback.sortHighest',
  lowest: 'coach.feedback.sortLowest',
} as const;

/**
 * Own ratings only — `coach_get_my_ratings()` is scoped server-side to `coach_id = auth.uid()`, no
 * client-side filter to bypass. Never shows `issue_reports` (no link, no data fetched for it at
 * all — the Coach has no RLS/RPC access to that table). Same flat table shape as the Manager's
 * Feedback screen (one row per rating, not grouped), but here the Coach can actually reply to the
 * client — the Manager's table only lets the Manager leave a private note, never a reply.
 */
export function CoachFeedbackScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const ratings = useAsync(() => getMyRatings(), []);
  const { dateKey } = useSelectedDate();
  const [query, setQuery] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [sort, setSort] = useState<SortOrder>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const queryLower = query.trim().toLowerCase();
  const filtered = (ratings.data ?? [])
    .filter(
      (r) =>
        isOnDateKey(r.createdAt, dateKey) &&
        r.rating >= minStars &&
        (!queryLower || (r.clientName ?? '').toLowerCase().includes(queryLower) || (r.comment ?? '').toLowerCase().includes(queryLower))
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

  return (
    <Screen onRefresh={ratings.reload} refreshing={ratings.loading && ratings.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={StarFilledIcon} label={t('coach.feedback.title')} notifications={<CoachNotifications />} />
      </View>

      <View style={[{ borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.glassBorder, padding: spacing.lg, gap: spacing.md }, CARD_SHADOW]}>
        <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
          {t('coach.feedback.subtitle')}
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
              placeholder={t('coach.feedback.filterCliente')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('coach.feedback.filterCliente')}
              autoComplete="off"
              textContentType="none"
              style={{ flex: 1, color: theme.text, fontSize: 14 }}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('coach.feedback.filters')}
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
            <AppText style={{ fontSize: 13, fontWeight: '700' }}>{t('coach.feedback.filters')}</AppText>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <FilterChip label={minStars > 0 ? t('coach.feedback.chipStars', { n: minStars }) : t('coach.feedback.chipStarsAll')} active={minStars > 0} onPress={() => setFiltersOpen(true)} />
          <FilterChip label={t(SORT_LABEL_KEY[sort])} active={sort !== 'recent'} onPress={() => setFiltersOpen(true)} />
        </View>

        {ratings.error ? <Banner title={t('coach.feedback.error')} /> : null}
        {ratings.data === undefined && ratings.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
        {ratings.data && filtered.length === 0 ? <Banner message={t('coach.feedback.empty')} /> : null}

        {pageRows.length > 0 ? (
          <View style={{ width: '100%', borderRadius: radius.lg, borderWidth: 1, borderColor: theme.glassBorder, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: theme.surfaceAlt }}>
              <HeaderCell flex={COL.date} label={t('coach.feedback.col.date')} />
              <HeaderCell flex={COL.client} label={t('coach.feedback.col.client')} />
              <HeaderCell flex={COL.rating} label={t('coach.feedback.col.rating')} />
              <HeaderCell flex={COL.comment} label={t('coach.feedback.col.comment')} />
              <HeaderCell flex={COL.status} label={t('coach.feedback.col.status')} />
              <HeaderCell flex={COL.actions} label={t('coach.feedback.col.actions')} align="right" />
            </View>

            {pageRows.map((entry, i) => (
              <FeedbackTableRow key={entry.id} entry={entry} showDivider={i > 0} lang={lang} onOpen={() => setDetailId(entry.id)} />
            ))}
          </View>
        ) : null}

        {filtered.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <AppText variant="caption" muted>
              {t('coach.feedback.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
            </AppText>
            <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('coach.feedback.nextPage')} />
          </View>
        ) : null}
      </View>

      <ActionSheet visible={filtersOpen} title={t('coach.feedback.filters')} actions={[]} onClose={() => setFiltersOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <FilterGroup
            label={t('coach.feedback.filterMinStars')}
            value={minStars}
            options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? t('coach.feedback.filterAll') : `${n}+` }))}
            onChange={(v) => resetFilter(setMinStars, v)}
          />
          <FilterGroup
            label={t('coach.feedback.sortLabel')}
            value={sort}
            options={(['recent', 'oldest', 'highest', 'lowest'] as const).map((s) => ({ value: s, label: t(SORT_LABEL_KEY[s]) }))}
            onChange={(v) => resetFilter(setSort, v)}
          />
        </View>
      </ActionSheet>

      <FeedbackDetailSheet entry={detailEntry} onClose={() => setDetailId(null)} onSentReply={ratings.reload} lang={lang} />
    </Screen>
  );
}

function FeedbackTableRow({ entry, showDivider, lang, onOpen }: { entry: CoachRatingEntry; showDivider: boolean; lang: Lang; onOpen: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const clientLabel = entry.clientName || t('common.unnamedPerson');
  const statusColor = entry.coachReply ? theme.band.green.solid : theme.danger;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('coach.feedback.rowActions')}
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

      <View style={{ flex: COL.rating }}>
        <StarRatingDisplay value={entry.rating} size={13} />
      </View>

      <View style={{ flex: COL.comment }}>
        <AppText numberOfLines={1} muted style={{ fontSize: 13 }}>
          {entry.comment || '—'}
        </AppText>
      </View>

      <View style={{ flex: COL.status }}>
        <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: `${statusColor}22` }}>
          <AppText color={statusColor} style={{ fontSize: 11, fontWeight: '800' }}>
            {t(entry.coachReply ? 'coach.feedback.status.replied' : 'coach.feedback.status.notReplied')}
          </AppText>
        </View>
      </View>

      <View style={{ flex: COL.actions, alignItems: 'flex-end', paddingRight: 2 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border }}>
          <EyeIcon color={theme.text} size={17} />
        </View>
      </View>
    </Pressable>
  );
}

/** Tapping "Azioni" opens the full comment, the manager's private note (read-only — the Coach never
 * writes one, only reads it), and either the Coach's existing reply or a composer to send one. */
function FeedbackDetailSheet({
  entry,
  onClose,
  onSentReply,
  lang,
}: {
  entry: CoachRatingEntry | null;
  onClose: () => void;
  onSentReply: () => void;
  lang: Lang;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(): Promise<void> {
    if (!entry) return;
    const text = replyText.trim();
    if (!text) return;
    setBusy(true);
    try {
      await replyToRating(entry.id, text);
      setReplying(false);
      setReplyText('');
      onSentReply();
    } finally {
      setBusy(false);
    }
  }

  function close(): void {
    setReplying(false);
    setReplyText('');
    onClose();
  }

  if (!entry) return <ActionSheet visible={false} title="" actions={[]} onClose={close} />;
  const clientLabel = entry.clientName || t('common.unnamedPerson');

  return (
    <ActionSheet visible title={t('coach.feedback.fromClient', { name: clientLabel })} actions={[]} onClose={close}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="caption" muted>
            {new Date(entry.createdAt).toLocaleDateString(lang)}
          </AppText>
          <StarRatingDisplay value={entry.rating} size={16} />
        </View>

        {entry.comment ? <AppText style={{ fontSize: 14, lineHeight: 19 }}>{entry.comment}</AppText> : null}

        {entry.managerNote ? (
          <View style={{ padding: spacing.sm, borderRadius: radius.sm, backgroundColor: theme.band.amber.soft, gap: 2 }}>
            <AppText color={theme.band.amber.onSoft} variant="caption" style={{ fontWeight: '700' }}>
              {t('coach.feedback.managerNote')}
            </AppText>
            <AppText color={theme.band.amber.onSoft} style={{ fontSize: 13, lineHeight: 18 }}>
              {entry.managerNote}
            </AppText>
          </View>
        ) : null}

        {entry.coachReply ? (
          <View style={{ padding: spacing.sm, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, gap: 2 }}>
            <AppText variant="caption" muted style={{ fontWeight: '700' }}>
              {t('coach.feedback.yourReply')}
            </AppText>
            <AppText style={{ fontSize: 13, lineHeight: 18 }}>{entry.coachReply}</AppText>
          </View>
        ) : replying ? (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t('coach.feedback.replyPlaceholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('coach.feedback.replyPlaceholder')}
              multiline
              numberOfLines={2}
              autoFocus
              style={{
                minHeight: 56,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                color: theme.text,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
            <Button label={t('coach.feedback.sendReply')} onPress={() => void send()} disabled={replyText.trim() === '' || busy} />
          </View>
        ) : (
          <Pressable onPress={() => setReplying(true)} accessibilityRole="button" accessibilityLabel={t('coach.feedback.reply')} style={{ alignSelf: 'flex-start' }}>
            <AppText style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>{t('coach.feedback.reply')}</AppText>
          </Pressable>
        )}
      </View>
    </ActionSheet>
  );
}

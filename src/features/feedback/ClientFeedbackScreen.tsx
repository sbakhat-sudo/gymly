import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { DateBadge } from '@/components/DateBadge';
import { FilterGroup } from '@/components/FilterControls';
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, StarFilledIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { StarRatingDisplay } from '@/components/StarRating';
import { Pagination } from '@/components/TablePagination';
import { useAuth } from '@/lib/auth/auth-context';
import { avatarTint } from '@/lib/avatar-tint';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { getMyRatingsHistory, type MyRatingEntry } from '@/lib/feedback-api';
import { formatClockTime, formatDayLabel } from '@/lib/format';
import { useI18n, type Lang } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';

const PAGE_SIZE = 8;

const SORT_LABEL_KEY = {
  recent: 'feedback.history.sortRecent',
  oldest: 'feedback.history.sortOldest',
  highest: 'feedback.history.sortHighest',
  lowest: 'feedback.history.sortLowest',
} as const;

/**
 * The Client's standalone "Feedback" tab: a read-only, searchable history of ratings already sent
 * (spec 2.4), with the Coach's reply if any — as a vertical card list, not the flat DATA/CLIENTE/…
 * table the Manager's and Coach's own Feedback screens use. Those two are web-sidebar dashboards
 * with real width to spend on columns; the Client app is phone-only (CLAUDE.md), and the same table
 * squeezed onto a ~390px screen genuinely doesn't fit — confirmed live on a real phone, where every
 * column wrapped onto multiple lines and overlapped the next one. One card per rating keeps the same
 * search/date/sort filtering and pagination, just stacked instead of columned. "Cliente" on each card
 * is always this signed-in client's own name/avatar (every entry is a rating THEY sent); the only
 * thing that varies entry to entry is the Coach it went to, the rating, and whether that Coach has
 * replied yet. Submitting feedback itself happens only via the popup that opens right after check-out
 * (`SubmitFeedbackScreen.tsx`, pushed from `use-real-checkin.ts#doCheckOut`) — there is deliberately
 * no "pick an old check-out" picker here. No manager-note box anywhere on this screen, by design:
 * the Manager's note is Manager↔Coach only and never reaches the Client (confirmed explicitly, same
 * rule as everywhere else in this module).
 */
export function ClientFeedbackScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const ratings = useAsync(() => getMyRatingsHistory(), []);
  const { dateKey } = useSelectedDate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const myName = auth.status === 'active' ? auth.profile.fullName || t('common.unnamedPerson') : t('common.unnamedPerson');
  const myAvatarUrl = auth.status === 'active' ? auth.profile.avatarUrl : null;

  const queryLower = query.trim().toLowerCase();
  const filtered = (ratings.data ?? [])
    .filter(
      (r) =>
        isOnDateKey(r.createdAt, dateKey) &&
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

  return (
    <Screen onRefresh={ratings.reload} refreshing={ratings.loading && ratings.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <PageTitle icon={StarFilledIcon} label={t('feedback.tab.title')} circleSize={22} fontSize={26} />
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('feedback.tab.subtitle')}
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: MIN_TAP + 4,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}>
          <SearchIcon color={theme.textMuted} size={17} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setPage(0);
            }}
            placeholder={t('feedback.history.searchPlaceholder')}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t('feedback.history.searchPlaceholder')}
            autoComplete="off"
            textContentType="none"
            style={{ flex: 1, color: theme.text, fontSize: 14 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <DateBadge />
          </View>
          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('feedback.history.sortLabel')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 44,
              paddingHorizontal: 16,
              borderRadius: radius.pill,
              backgroundColor: theme.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <CalendarIcon color={theme.textMuted} size={16} strokeWidth={2.2} />
            <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: '700' }}>
              {t(SORT_LABEL_KEY[sort])}
            </AppText>
            <ChevronDownIcon color={theme.textMuted} size={16} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <ActionSheet visible={sortOpen} title={t('feedback.history.sortLabel')} actions={[]} onClose={() => setSortOpen(false)}>
        <FilterGroup
          label={t('feedback.history.sortLabel')}
          value={sort}
          options={(['recent', 'oldest', 'highest', 'lowest'] as const).map((s) => ({ value: s, label: t(SORT_LABEL_KEY[s]) }))}
          onChange={(v) => {
            setSort(v);
            setPage(0);
            setSortOpen(false);
          }}
        />
      </ActionSheet>

      {ratings.error ? <Banner title={t('feedback.history.error')} /> : null}
      {ratings.data === undefined && ratings.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {ratings.data && filtered.length === 0 ? <EmptyState message={t('feedback.history.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {pageRows.map((entry) => (
            <FeedbackCard key={entry.id} entry={entry} myName={myName} myAvatarUrl={myAvatarUrl} lang={lang} onOpen={() => setDetailId(entry.id)} />
          ))}
        </View>
      ) : null}

      {filtered.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {t('feedback.history.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, filtered.length), total: filtered.length })}
          </AppText>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('feedback.history.nextPage')} />
        </View>
      ) : null}

      <FeedbackDetailSheet entry={detailEntry} myName={myName} myAvatarUrl={myAvatarUrl} onClose={() => setDetailId(null)} lang={lang} />
    </Screen>
  );
}

/** One rating, one card: avatar+name+stars on top, a short comment preview, the date, and a
 * Risposto/Non risposto pill — everything a row's 6 table columns held, just stacked instead of
 * squeezed side by side. Tapping anywhere on the card opens the same detail sheet the table's eye
 * icon used to. */
function FeedbackCard({
  entry,
  myName,
  myAvatarUrl,
  lang,
  onOpen,
}: {
  entry: MyRatingEntry;
  myName: string;
  myAvatarUrl: string | null;
  lang: Lang;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const statusColor = entry.coachReply ? theme.band.green.solid : theme.danger;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('feedback.history.rowActions')}
      style={({ pressed }) => [{ borderRadius: radius.card, backgroundColor: theme.surface, padding: spacing.md, gap: spacing.sm, opacity: pressed ? 0.85 : 1 }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={myAvatarUrl} name={myName} size={40} tint={avatarTint(theme, myName)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 15 }}>
            {myName}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {new Date(entry.createdAt).toLocaleDateString(lang)}
          </AppText>
        </View>
        <StarRatingDisplay value={entry.rating} size={14} />
      </View>

      {entry.comment ? (
        <AppText numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>
          {entry.comment}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: `${statusColor}22` }}>
          <AppText color={statusColor} style={{ fontSize: 11, fontWeight: '800' }}>
            {t(entry.coachReply ? 'feedback.history.status.replied' : 'feedback.history.status.notReplied')}
          </AppText>
        </View>
        <ChevronRightIcon color={theme.textMuted} size={16} />
      </View>
    </Pressable>
  );
}

/** Tapping "Azioni" opens the full comment, who it was sent to, and the Coach's reply if any —
 * read-only, same as the row itself: there is nothing for the Client to write or change here. */
function FeedbackDetailSheet({
  entry,
  myName,
  myAvatarUrl,
  onClose,
  lang,
}: {
  entry: MyRatingEntry | null;
  myName: string;
  myAvatarUrl: string | null;
  onClose: () => void;
  lang: Lang;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  if (!entry) return <ActionSheet visible={false} title="" actions={[]} onClose={onClose} />;
  const coachLabel = entry.coachName || t('common.unnamedPerson');

  return (
    <ActionSheet visible title={t('feedback.history.title')} actions={[]} onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Avatar uri={myAvatarUrl} name={myName} size={36} tint={avatarTint(theme, myName)} />
          <View style={{ flex: 1 }}>
            <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
              {myName}
            </AppText>
            <AppText variant="caption" muted numberOfLines={1}>
              {formatDayLabel(lang, entry.createdAt)} • {formatClockTime(lang, entry.createdAt)} • {coachLabel}
            </AppText>
          </View>
          <StarRatingDisplay value={entry.rating} size={16} />
        </View>

        {entry.comment ? <AppText style={{ fontSize: 14, lineHeight: 19 }}>{entry.comment}</AppText> : null}

        {entry.coachReply ? (
          <View style={{ gap: 2 }}>
            <AppText style={{ color: theme.band.green.solid, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 11 * 0.06 }}>
              {t('feedback.history.replyTag')}
            </AppText>
            <AppText style={{ fontSize: 14, lineHeight: 19 }}>{entry.coachReply}</AppText>
          </View>
        ) : (
          <AppText variant="caption" muted style={{ fontSize: 13 }}>
            {t('feedback.history.awaitingReply')}
          </AppText>
        )}
      </View>
    </ActionSheet>
  );
}

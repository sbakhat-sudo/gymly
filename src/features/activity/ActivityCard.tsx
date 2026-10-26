import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { PulseIcon } from '@/components/icons';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getActivityFeed, type ActivityEvent, type ActivityEventType, type ActivityRole } from './activity-api';

const PAGE = 20;

const EVENT_KEY: Record<ActivityEventType, TranslationKey> = {
  checkin: 'activity.event.checkin',
  checkout: 'activity.event.checkout',
  payment: 'activity.event.payment',
  rating: 'activity.event.rating',
  issue: 'activity.event.issue',
  account_created: 'activity.event.account_created',
  activated: 'activity.event.activated',
  deactivated: 'activity.event.deactivated',
  sign_in: 'activity.event.sign_in',
};

const ROLE_KEY: Record<ActivityRole, TranslationKey> = {
  owner: 'activity.role.owner',
  manager: 'activity.role.manager',
  coach: 'activity.role.coach',
  client: 'activity.role.client',
};

/**
 * "Attività" card for Impostazioni: what the people this role oversees did, newest first — filterable by role,
 * with "carica altre" for older events. `roles` is who this viewer may see (Owner: manager/coach/client, Admin:
 * owner/coach/client, Manager: coach/client); the database enforces the same limits whatever is passed here.
 */
export function ActivityCard({ roles }: { roles: ActivityRole[] }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [role, setRole] = useState<ActivityRole | null>(null);
  const first = useAsync(() => getActivityFeed(PAGE, null, role), [role]);
  // Older pages, tagged with the filter they were loaded for so a stale page never leaks into another filter.
  const [more, setMore] = useState<{ role: ActivityRole | null; items: ActivityEvent[]; full: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const extra = more && more.role === role ? more : null;
  const items = [...(first.data ?? []), ...(extra?.items ?? [])];
  const canLoadMore = first.data !== undefined && (extra ? extra.full : first.data.length >= PAGE);
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';

  async function loadMore(): Promise<void> {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await getActivityFeed(PAGE, last.at, role);
      setMore({ role, items: [...(extra?.items ?? []), ...page], full: page.length >= PAGE });
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText accessibilityRole="header" style={{ paddingHorizontal: 6, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, color: theme.textMuted }}>
        {t('activity.title')}
      </AppText>
      <View style={{ borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {([null, ...roles] as (ActivityRole | null)[]).map((r) => {
            const selected = role === r;
            return (
              <Pressable
                key={r ?? 'all'}
                onPress={() => setRole(r)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{ minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.surfaceAlt : 'transparent' }}>
                <AppText style={{ fontWeight: '700', fontSize: 13, color: selected ? theme.primary : theme.text }}>{t(r === null ? 'activity.filter.all' : ROLE_KEY[r])}</AppText>
              </Pressable>
            );
          })}
        </View>

        {first.error ? <Banner title={t('activity.error')} /> : null}
        {first.data === undefined && first.loading ? <ActivityIndicator /> : null}
        {first.data && items.length === 0 ? <EmptyState message={t('activity.empty')} icon={PulseIcon} /> : null}

        {items.length > 0 ? (
          <View>
            {items.map((e, i) => (
              <View
                key={`${e.type}-${e.actorId}-${e.at}-${i}`}
                accessible
                accessibilityLabel={`${e.actorName}, ${t(ROLE_KEY[e.actorRole])}: ${t(EVENT_KEY[e.type])}${e.detail ? `, ${e.detail}` : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                <Avatar uri={null} name={e.actorName} size={36} tint={avatarTint(theme, e.actorName)} />
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
                    {e.actorName} <AppText muted style={{ fontWeight: '600', fontSize: 12 }}>· {t(ROLE_KEY[e.actorRole])}</AppText>
                  </AppText>
                  <AppText muted style={{ fontSize: 13 }}>
                    {t(EVENT_KEY[e.type])}
                    {e.detail ? ` · ${e.detail}` : ''}
                  </AppText>
                </View>
                <AppText variant="caption" muted style={{ textAlign: 'right' }}>
                  {new Date(e.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {moreError ? <Banner title={t('activity.error')} /> : null}
        {canLoadMore ? (
          <Pressable
            onPress={() => void loadMore()}
            disabled={loadingMore}
            accessibilityRole="button"
            style={{ minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: theme.border, opacity: loadingMore ? 0.6 : 1 }}>
            <AppText style={{ fontWeight: '700', fontSize: 14, color: theme.primary }}>{t('activity.more')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

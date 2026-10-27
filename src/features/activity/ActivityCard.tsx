import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { PulseIcon } from '@/components/icons';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getActivityFeed, type ActivityEvent, type ActivityRole } from './activity-api';

const PAGE = 20;
/** The list scrolls inside the card instead of stretching the whole page; the filters stay put above it. */
const LIST_MAX_HEIGHT = 420;

const EVENT_KEY: Record<string, TranslationKey> = {
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

const OP_KEY: Record<string, TranslationKey> = {
  insert: 'activity.op.insert',
  update: 'activity.op.update',
  delete: 'activity.op.delete',
};

const ENTITY_KEY: Record<string, TranslationKey> = {
  profile: 'activity.entity.profile',
  site: 'activity.entity.site',
  subscription: 'activity.entity.subscription',
  plan_card: 'activity.entity.plan_card',
  chain: 'activity.entity.chain',
  invite: 'activity.entity.invite',
  coach_note: 'activity.entity.coach_note',
  rating: 'activity.entity.rating',
  issue: 'activity.entity.issue',
  conversation: 'activity.entity.conversation',
  point_rule: 'activity.entity.point_rule',
  reward: 'activity.entity.reward',
  redemption: 'activity.entity.redemption',
  platform_setting: 'activity.entity.platform_setting',
};

/** Columns an edit can name, spelled out in plain words; anything else is shown as stored. */
const COLUMNS = [
  'full_name', 'first_name', 'last_name', 'phone', 'home_address', 'avatar_url', 'birth_date', 'birth_year', 'location_always',
  'requested_plan', 'membership_type', 'payment_status', 'subscription_required', 'profile_completed_at', 'role', 'site_id', 'name',
  'address', 'timezone', 'opening_hours', 'capacity_reference', 'points_enabled', 'manually_open', 'location', 'radius',
  'proximity_radius', 'band_green_pct', 'band_amber_pct', 'notify_manager_on_threshold', 'plan', 'status', 'approval_status',
  'card_id', 'plan_type', 'start_date', 'kind', 'active', 'price_eur', 'description', 'color', 'tier', 'duration_days', 'note',
  'coach_reply', 'manager_note', 'severity', 'resolved_at', 'title', 'cost', 'stock', 'points', 'daily_cap', 'from_time', 'to_time',
  'weekday_mask', 'default_capacity_reference', 'support_email', 'managers_can_create_cards', 'plan_paid_until', 'plan_status',
  'hq_address', 'expires_at', 'read_at',
] as const;

const ROLE_KEY: Record<ActivityRole, TranslationKey> = {
  owner: 'activity.role.owner',
  manager: 'activity.role.manager',
  coach: 'activity.role.coach',
  client: 'activity.role.client',
};

/** The sentence for an event: a derived one ("è entrato in palestra") or a logged action ("ha modificato il profilo"). */
function describe(t: ReturnType<typeof useI18n>['t'], type: string): string {
  const derived = EVENT_KEY[type];
  if (derived) return t(derived);
  const [entity = '', op = ''] = type.split(':');
  if (entity === 'message') return t('activity.log.message');
  const opKey = OP_KEY[op];
  const entityKey = ENTITY_KEY[entity];
  return [opKey ? t(opKey) : op, entityKey ? t(entityKey) : entity].join(' ');
}

/** The detail line: an edit lists the fields it changed in plain words; everything else shows as stored. */
function describeDetail(t: ReturnType<typeof useI18n>['t'], type: string, detail: string | null): string | null {
  if (!detail) return null;
  if (!type.endsWith(':update')) return detail;
  return detail
    .split(',')
    .map((c) => ((COLUMNS as readonly string[]).includes(c) ? t(`activity.col.${c}` as TranslationKey) : c))
    .join(', ');
}

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

        {items.length > 0 || canLoadMore ? (
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: LIST_MAX_HEIGHT }} contentContainerStyle={{ gap: spacing.md }}>
          <View>
            {items.map((e, i) => (
              <View
                key={`${e.type}-${e.actorId}-${e.at}-${i}`}
                accessible
                accessibilityLabel={`${e.actorName}, ${t(ROLE_KEY[e.actorRole])}: ${describe(t, e.type)}${describeDetail(t, e.type, e.detail) ? `, ${describeDetail(t, e.type, e.detail)}` : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                <ProfileAvatar userId={e.actorId} name={e.actorName} size={36} tint={avatarTint(theme, e.actorName)} />
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
                    {e.actorName} <AppText muted style={{ fontWeight: '600', fontSize: 12 }}>· {t(ROLE_KEY[e.actorRole])}</AppText>
                  </AppText>
                  <AppText muted style={{ fontSize: 13 }}>
                    {describe(t, e.type)}
                    {describeDetail(t, e.type, e.detail) ? ` · ${describeDetail(t, e.type, e.detail)}` : ''}
                  </AppText>
                </View>
                <AppText variant="caption" muted style={{ textAlign: 'right' }}>
                  {new Date(e.at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </AppText>
              </View>
            ))}
          </View>

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
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

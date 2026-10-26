import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { SectionLabel } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChevronDownIcon, CreditCardIcon, EyeIcon, PlusIcon, SlidersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderCell, Pagination } from '@/components/TablePagination';
import { FilterGroup } from '@/components/FilterControls';
import {
  assignPlan,
  createPlanCard,
  deletePlanCard,
  deleteSubscription,
  getManagerClientSubscriptions,
  getManagerPlanCards,
  getManagersCanCreateCards,
  setPlanCardActive,
  setSubscriptionStatus,
  updatePlanCard,
  type ClientSubscriptionRow,
  type PlanCard,
  type PlanCardTier,
  type SubscriptionStatus,
} from '@/features/billing/billing-api';
import { TIER_BADGE_COLOR, TIER_LABEL_KEY } from '@/features/billing/plan-tier';
import { ManagerNotifications } from '@/features/manager/ManagerNotifications';
import { decorativeA11yProps } from '@/lib/a11y';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

const PAGE_SIZE = 8;
const COL = { name: 1.8, plan: 1, expiry: 1.2, status: 1.2, actions: 1 };

/** A card's colour is never freely picked — it's one of exactly 6 fixed hues, one per
 * Durata × Livello combination, so the colour alone already says something ("this is the annual
 * VIP card") instead of being an arbitrary choice. Not pulled from the theme's band tones either —
 * those are reserved for status (green = active, amber = grace, red = blocked) elsewhere on this
 * same screen. A fixed hex reads the same in light and dark, same as any other explicit brand choice. */
const PLAN_CARD_COLOR_MAP: Record<'monthly' | 'annual', Record<PlanCardTier, string>> = {
  monthly: { normal: '#8B5CF6', vip: '#F97316', vvip: '#3B82F6' },
  annual: { normal: '#EAB308', vip: '#EF4444', vvip: '#22C55E' },
};

type StatusFilter = 'all' | SubscriptionStatus | 'none';

const STATUS_LABEL_KEY: Record<SubscriptionStatus, TranslationKey> = {
  active: 'manager.subscriptions.status.active',
  grace: 'manager.subscriptions.status.grace',
  blocked: 'manager.subscriptions.status.blocked',
};

/** Days → a short, readable duration ("30 giorni", "1 anno", "3 mesi") instead of a raw number —
 * exact multiples of 30/365 read as months/years (how a Manager actually thinks about a plan),
 * anything else falls back to the literal day count rather than a misleading rounded one. */
function formatDuration(t: ReturnType<typeof useI18n>['t'], days: number): string {
  const pick = (n: number, base: 'days' | 'months' | 'years'): string => t(`manager.subscriptions.cards.duration.${base}.${n === 1 ? 'one' : 'other'}`, { n });
  if (days % 365 === 0) return pick(days / 365, 'years');
  if (days % 30 === 0) return pick(days / 30, 'months');
  return pick(days, 'days');
}

/**
 * "Abbonamenti" — same search + status-chip-filter + table shape as `ManagerIssuesScreen.tsx` (not
 * `PeopleScreen.tsx`'s static roster), since that's the closest existing screen to what this needs.
 * A Client with no `subscriptions` row still appears (the RPC LEFT JOINs), shown as "Nessun piano"
 * with an "Assegna piano" action — the only way an existing/grandfathered Client ever gets one.
 *
 * "Le mie carte" above the table is the Manager's own plan catalog (name/price/duration) — the actual
 * thing a real gym needs to define once and reuse, rather than this app ever inventing a price. Every
 * "Assegna piano" picks from this live list, and every new price takes effect for new assignments
 * only — an existing subscription already snapshotted its own terms (see the SQL migration's own
 * comment), never silently repriced by editing the card afterwards.
 */
export function ManagerSubscriptionsScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const rows = useAsync(() => getManagerClientSubscriptions(), []);
  const cards = useAsync(() => getManagerPlanCards(), []);
  // Owner-made cards are read-only here; "nuova carta" only shows when the Owner allows Managers their own.
  const canCreate = useAsync(() => getManagersCanCreateCards(), []);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ClientSubscriptionRow | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [cardSheet, setCardSheet] = useState<'new' | PlanCard | null>(null);
  const [menuTarget, setMenuTarget] = useState<ClientSubscriptionRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClientSubscriptionRow | null>(null);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<PlanCard | null>(null);
  const [rowActionBusy, setRowActionBusy] = useState(false);

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
  const activeCards = (cards.data ?? []).filter((c) => c.active);

  function resetFilter<T>(setter: (v: T) => void, value: T): void {
    setter(value);
    setPage(0);
  }

  async function assign(cardId: string): Promise<void> {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await assignPlan(assignTarget.clientId, cardId);
      setAssignTarget(null);
      rows.reload();
    } finally {
      setAssigning(false);
    }
  }

  async function setRowStatus(row: ClientSubscriptionRow, status: 'active' | 'blocked'): Promise<void> {
    setRowActionBusy(true);
    try {
      await setSubscriptionStatus(row.clientId, status);
      setMenuTarget(null);
      rows.reload();
    } finally {
      setRowActionBusy(false);
    }
  }

  async function deleteRow(row: ClientSubscriptionRow): Promise<void> {
    setRowActionBusy(true);
    try {
      await deleteSubscription(row.clientId);
      setConfirmDelete(null);
      rows.reload();
    } finally {
      setRowActionBusy(false);
    }
  }

  async function toggleCardActive(card: PlanCard): Promise<void> {
    await setPlanCardActive(card.id, !card.active);
    setCardSheet(null);
    cards.reload();
  }

  async function deleteCard(card: PlanCard): Promise<void> {
    await deletePlanCard(card.id);
    setConfirmDeleteCard(null);
    cards.reload();
    rows.reload();
  }

  return (
    <Screen onRefresh={rows.reload} refreshing={rows.loading && rows.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={CreditCardIcon} label={t('manager.subscriptions.title')} notifications={<ManagerNotifications />} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>{t('manager.subscriptions.cards.title')}</SectionLabel>
          {canCreate.data === true ? (
            <Pressable
              onPress={() => setCardSheet('new')}
              accessibilityRole="button"
              accessibilityLabel={t('manager.subscriptions.cards.new')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <PlusIcon color={theme.primary} size={14} />
              <AppText style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>{t('manager.subscriptions.cards.new')}</AppText>
            </Pressable>
          ) : null}
        </View>

        {cards.loading && cards.data === undefined ? <ActivityIndicator /> : null}
        {cards.data && cards.data.length === 0 ? (
          <AppText muted style={{ fontSize: 13 }}>
            {t('manager.subscriptions.cards.empty')}
          </AppText>
        ) : null}

        {cards.data && cards.data.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {cards.data.map((c) => {
              // Seeded by name, not `c.id` — the client table's own row (no card id to go on, just
              // `planName`) must land on the exact same fallback colour for the same plan, or a
              // card with no explicit colour shows one hue on "Le mie carte" and a different one on
              // the rows actually subscribed to it.
              const tint = c.color ?? avatarTint(theme, c.name);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => (c.ownerCardId === null ? setCardSheet(c) : undefined)}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  style={({ pressed }) => ({
                    minWidth: 150,
                    flexGrow: 1,
                    padding: spacing.md,
                    borderRadius: radius.card,
                    backgroundColor: `${tint}0f`,
                    borderWidth: 1,
                    borderColor: theme.glassBorder,
                    borderTopWidth: 3,
                    borderTopColor: tint,
                    opacity: pressed ? 0.85 : c.active ? 1 : 0.55,
                    gap: 2,
                  })}>
                  {c.tier !== 'normal' ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        borderRadius: radius.pill,
                        backgroundColor: TIER_BADGE_COLOR[c.tier],
                        marginBottom: 2,
                      }}>
                      <AppText style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>{t(TIER_LABEL_KEY[c.tier])}</AppText>
                    </View>
                  ) : null}
                  <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
                    {c.name}
                  </AppText>
                  {c.priceEur !== null ? <AppText style={{ fontFamily: fontFamily.display, fontSize: 20, color: tint }}>€{c.priceEur.toFixed(2)}</AppText> : null}
                  <AppText variant="caption" muted>
                    {formatDuration(t, c.durationDays)}
                    {!c.active ? ` · ${t('manager.subscriptions.cards.inactive')}` : ''}
                  </AppText>
                  {c.description ? (
                    <AppText variant="caption" muted numberOfLines={2} style={{ marginTop: 2 }}>
                      {c.description}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
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
            <SubscriptionRow key={row.clientId} row={row} showDivider={i > 0} onOpenActions={() => setMenuTarget(row)} />
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
        actions={
          activeCards.length === 0
            ? []
            : activeCards.map((c) => ({ label: c.priceEur === null ? c.name : `${c.name} — €${c.priceEur.toFixed(2)}`, onPress: () => void assign(c.id), disabled: assigning }))
        }>
        {activeCards.length === 0 ? (
          <AppText muted style={{ fontSize: 13 }}>
            {t('manager.subscriptions.cards.empty')}
          </AppText>
        ) : null}
      </ActionSheet>

      <ActionSheet
        visible={menuTarget !== null}
        title={t('manager.subscriptions.actions.title')}
        subtitle={menuTarget?.fullName ?? undefined}
        onClose={() => setMenuTarget(null)}
        actions={
          menuTarget
            ? [
                // "Cambia piano" is deliberately not offered here once a Client already has one —
                // that choice belongs to the Client themselves, from their own account, not the
                // Manager acting on their behalf. "Assegna piano" only ever applies to onboarding
                // someone who has none yet (the one gap a Client can't fill in from their side).
                ...(menuTarget.status === null
                  ? [
                      {
                        label: t('manager.subscriptions.assign.button'),
                        onPress: () => {
                          setAssignTarget(menuTarget);
                          setMenuTarget(null);
                        },
                      },
                    ]
                  : []),
                ...(menuTarget.status !== null && menuTarget.status !== 'active'
                  ? [{ label: t('manager.subscriptions.actions.activate'), onPress: () => void setRowStatus(menuTarget, 'active'), disabled: rowActionBusy }]
                  : []),
                ...(menuTarget.status === 'active'
                  ? [{ label: t('manager.subscriptions.actions.deactivate'), onPress: () => void setRowStatus(menuTarget, 'blocked'), disabled: rowActionBusy, destructive: true }]
                  : []),
                ...(menuTarget.status !== null
                  ? [
                      {
                        label: t('manager.subscriptions.actions.delete'),
                        destructive: true,
                        onPress: () => {
                          setConfirmDelete(menuTarget);
                          setMenuTarget(null);
                        },
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <ConfirmDialog
        visible={confirmDelete !== null}
        destructive
        title={t('manager.subscriptions.actions.deleteConfirm.title')}
        message={t('manager.subscriptions.actions.deleteConfirm.body', { name: confirmDelete?.fullName ?? t('common.unnamedPerson') })}
        confirmLabel={t('manager.subscriptions.actions.delete')}
        onConfirm={() => confirmDelete && void deleteRow(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        visible={confirmDeleteCard !== null}
        destructive
        title={t('manager.subscriptions.cards.deleteConfirm.title')}
        message={t('manager.subscriptions.cards.deleteConfirm.body', { name: confirmDeleteCard?.name ?? '' })}
        confirmLabel={t('manager.subscriptions.cards.delete')}
        onConfirm={() => confirmDeleteCard && void deleteCard(confirmDeleteCard)}
        onCancel={() => setConfirmDeleteCard(null)}
      />

      <PlanCardSheet
        target={cardSheet}
        onClose={() => setCardSheet(null)}
        onSaved={() => {
          setCardSheet(null);
          cards.reload();
        }}
        onToggleActive={cardSheet && cardSheet !== 'new' ? () => void toggleCardActive(cardSheet) : undefined}
        onDelete={
          cardSheet && cardSheet !== 'new'
            ? () => {
                setConfirmDeleteCard(cardSheet);
                setCardSheet(null);
              }
            : undefined
        }
      />
    </Screen>
  );
}

/** Create (target === 'new') or edit (target === a PlanCard) a membership card — name/price/duration,
 * plus an active/inactive toggle when editing (never a delete: history must keep pointing at
 * something real, see the migration's own comment on `card_id`). */
function PlanCardSheet({
  target,
  onClose,
  onSaved,
  onToggleActive,
  onDelete,
}: {
  target: 'new' | PlanCard | null;
  onClose: () => void;
  onSaved: () => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const editing = target !== null && target !== 'new' ? target : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [price, setPrice] = useState(editing?.priceEur != null ? String(editing.priceEur) : '');
  const [durationUnit, setDurationUnit] = useState<'monthly' | 'annual'>(editing && editing.durationDays % 365 === 0 ? 'annual' : 'monthly');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [tier, setTier] = useState<PlanCardTier>(editing?.tier ?? 'normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [wasTarget, setWasTarget] = useState(target);

  if (target !== wasTarget) {
    setWasTarget(target);
    const next = target !== null && target !== 'new' ? target : null;
    setName(next?.name ?? '');
    setPrice(next?.priceEur != null ? String(next.priceEur) : '');
    setDurationUnit(next && next.durationDays % 365 === 0 ? 'annual' : 'monthly');
    setDescription(next?.description ?? '');
    setTier(next?.tier ?? 'normal');
    setError(false);
  }

  // No free colour picker — the colour is one of 6 fixed ones, decided entirely by
  // Durata × Livello (PLAN_CARD_COLOR_MAP), so it always says something consistent at a glance
  // ("this is a monthly VIP card") instead of whatever hue the Manager happened to click.
  const color = PLAN_CARD_COLOR_MAP[durationUnit][tier];

  async function save(): Promise<void> {
    const priceNum = Number(price.replace(',', '.'));
    const daysNum = durationUnit === 'monthly' ? 30 : 365;
    if (name.trim().length === 0 || !Number.isFinite(priceNum) || priceNum < 0) {
      setError(true);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      const descriptionOrNull = description.trim().length > 0 ? description.trim() : null;
      if (editing) await updatePlanCard(editing.id, name, priceNum, daysNum, descriptionOrNull, color, tier);
      else await createPlanCard(name, priceNum, daysNum, descriptionOrNull, color, tier);
      onSaved();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    minHeight: MIN_TAP,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontSize: 15,
  } as const;

  return (
    <ActionSheet
      visible={target !== null}
      title={editing ? t('manager.subscriptions.cards.edit.title') : t('manager.subscriptions.cards.new')}
      onClose={onClose}
      actions={[
        { label: t('common.save'), onPress: () => void save(), disabled: saving },
        ...(editing && onToggleActive
          ? [{ label: editing.active ? t('manager.subscriptions.cards.deactivate') : t('manager.subscriptions.cards.activate'), onPress: onToggleActive, destructive: editing.active }]
          : []),
        ...(editing && onDelete ? [{ label: t('manager.subscriptions.cards.delete'), onPress: onDelete, destructive: true }] : []),
      ]}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.subscriptions.cards.name')}
          </AppText>
          <TextInput value={name} onChangeText={setName} placeholder={t('manager.subscriptions.cards.name')} placeholderTextColor={theme.textMuted} style={inputStyle} />
        </View>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.subscriptions.cards.price')}
          </AppText>
          <TextInput value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={theme.textMuted} keyboardType="decimal-pad" style={inputStyle} />
        </View>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.subscriptions.cards.days')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['monthly', 'annual'] as const).map((u) => {
              const selected = durationUnit === u;
              return (
                <Pressable
                  key={u}
                  onPress={() => setDurationUnit(u)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  style={{
                    flex: 1,
                    minHeight: MIN_TAP,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? `${theme.primary}14` : 'transparent',
                  }}>
                  <AppText style={{ fontSize: 14, fontWeight: '700', color: selected ? theme.primary : theme.text }}>
                    {t(u === 'monthly' ? 'manager.subscriptions.cards.monthly' : 'manager.subscriptions.cards.annual')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.subscriptions.cards.tier')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['normal', 'vip', 'vvip'] as const).map((tr) => {
              const selected = tier === tr;
              const badgeColor = TIER_BADGE_COLOR[tr];
              return (
                <Pressable
                  key={tr}
                  onPress={() => setTier(tr)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  style={{
                    flex: 1,
                    minHeight: MIN_TAP,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: selected ? badgeColor || theme.primary : theme.border,
                    backgroundColor: selected ? `${badgeColor || theme.primary}14` : 'transparent',
                  }}>
                  <AppText style={{ fontSize: 13, fontWeight: '700', color: selected ? badgeColor || theme.primary : theme.text }}>{t(TIER_LABEL_KEY[tr])}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color }} {...decorativeA11yProps} />
          <AppText variant="caption" muted>
            {t('manager.subscriptions.cards.color')}
          </AppText>
        </View>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {t('manager.subscriptions.cards.description')}
          </AppText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('manager.subscriptions.cards.description.placeholder')}
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            style={[inputStyle, { minHeight: 72, paddingTop: 10, textAlignVertical: 'top' }]}
          />
        </View>
        {error ? (
          <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600' }}>
            {t('manager.subscriptions.cards.error')}
          </AppText>
        ) : null}
      </View>
    </ActionSheet>
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

function SubscriptionRow({ row, showDivider, onOpenActions }: { row: ClientSubscriptionRow; showDivider: boolean; onOpenActions: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  // Same colour the plan's own card shows, kept in sync by manager_update_plan_card() — a row with
  // no plan at all gets no accent (there's nothing to colour), one whose card never had a colour
  // chosen falls back to the same deterministic auto-tint the card itself would use.
  const planTint = row.status === null ? null : (row.planColor ?? avatarTint(theme, row.planName ?? row.clientId));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        gap: spacing.sm,
        borderTopWidth: showDivider ? 1 : 0,
        borderTopColor: theme.glassBorder,
        borderLeftWidth: planTint ? 3 : 0,
        borderLeftColor: planTint ?? 'transparent',
        backgroundColor: planTint ? `${planTint}1a` : 'transparent',
      }}>
      <View style={{ flex: COL.name, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar uri={null} name={row.fullName} size={28} tint={avatarTint(theme, row.fullName ?? '?')} />
        <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, flexShrink: 1 }}>
          {row.fullName || t('common.unnamedPerson')}
        </AppText>
      </View>
      <View style={{ flex: COL.plan }}>
        <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: planTint ? '700' : '400', color: planTint ?? theme.text }}>
          {row.planName ?? '—'}
        </AppText>
      </View>
      <View style={{ flex: COL.expiry }}>
        <AppText style={{ fontSize: 13 }}>{row.expiryDate ? new Date(`${row.expiryDate}T00:00:00`).toLocaleDateString(lang) : '—'}</AppText>
      </View>
      <View style={{ flex: COL.status }}>
        <StatusPill status={row.status} />
      </View>
      <View style={{ flex: COL.actions, alignItems: 'flex-end' }}>
        <Pressable
          onPress={onOpenActions}
          accessibilityRole="button"
          accessibilityLabel={t('manager.subscriptions.actions.openFor', { name: row.fullName ?? t('common.unnamedPerson') })}
          style={({ pressed }) => ({
            width: MIN_TAP,
            height: MIN_TAP,
            borderRadius: MIN_TAP / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surfaceAlt,
            opacity: pressed ? 0.75 : 1,
          })}>
          <EyeIcon color={theme.text} size={17} />
        </Pressable>
      </View>
    </View>
  );
}

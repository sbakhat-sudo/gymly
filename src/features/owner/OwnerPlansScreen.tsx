import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChevronLeftIcon, CreditCardIcon, PlusIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { getManagersCanCreateCards } from '@/features/billing/billing-api';
import { avatarTint } from '@/lib/avatar-tint';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import {
  createOwnerPlanCard,
  deleteOwnerPlanCard,
  getOwnerPlanCards,
  setManagersCanCreateCards,
  setOwnerPlanCardActive,
  updateOwnerPlanCard,
  type OwnerPlanCard,
} from './owner-api';

type Kind = OwnerPlanCard['kind'];

/**
 * "Abbonamenti" — the Owner's own catalog: free-text name, monthly or annual, and the day it was
 * created. Every Manager in the chain sees these cards and assigns them to Clients; Managers can't
 * edit them. A switch lets the Owner also allow Managers to make cards of their own.
 */
export function OwnerPlansScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const isSidebar = useSidebarMode();
  const cards = useAsync(() => getOwnerPlanCards(), []);
  const allowed = useAsync(() => getManagersCanCreateCards(), []);
  const [sheet, setSheet] = useState<'new' | OwnerPlanCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OwnerPlanCard | null>(null);
  const [actionError, setActionError] = useState(false);
  usePageHeader(CreditCardIcon, t('owner.plans.title'));

  async function run(action: () => Promise<void>): Promise<void> {
    setActionError(false);
    try {
      await action();
      cards.reload();
    } catch {
      setActionError(true);
    }
  }

  return (
    <Screen onRefresh={cards.reload} refreshing={cards.loading && cards.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: 2, flex: 1 }}>
          {/* Sidebar mode already shows this title in the fixed top bar (`usePageHeader` above). */}
          {!isSidebar ? <AppText style={{ fontSize: 26, fontWeight: '800' }}>{t('owner.plans.title')}</AppText> : null}
          <AppText muted style={{ fontSize: 13 }}>
            {t('owner.plans.subtitle')}
          </AppText>
        </View>
        <Pressable
          onPress={() => setSheet('new')}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.primary }}>
          <PlusIcon color={theme.onPrimary} size={16} strokeWidth={2.4} />
          <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>{t('owner.plans.new')}</AppText>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '700', fontSize: 14 }}>{t('owner.plans.managersCreate')}</AppText>
          <AppText muted style={{ fontSize: 12.5 }}>
            {t('owner.plans.managersCreateHelp')}
          </AppText>
        </View>
        <Toggle
          value={allowed.data === true}
          disabled={allowed.data === undefined}
          accessibilityLabel={t('owner.plans.managersCreate')}
          onValueChange={(next) => {
            setActionError(false);
            setManagersCanCreateCards(next)
              .then(() => allowed.reload())
              .catch(() => setActionError(true));
          }}
        />
      </View>

      {cards.error || actionError ? <Banner title={t('owner.plans.error')} /> : null}
      {cards.data === undefined && cards.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {cards.data && cards.data.length === 0 ? <Banner message={t('owner.plans.empty')} /> : null}

      {cards.data && cards.data.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {cards.data.map((c) => {
            const tint = avatarTint(theme, c.name);
            return (
              <Pressable
                key={c.id}
                onPress={() => setSheet(c)}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                style={({ pressed }) => ({
                  minWidth: 200,
                  flexGrow: 1,
                  flexBasis: 220,
                  padding: spacing.md,
                  borderRadius: radius.card,
                  backgroundColor: `${tint}0f`,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                  borderTopWidth: 3,
                  borderTopColor: tint,
                  opacity: pressed ? 0.85 : c.active ? 1 : 0.55,
                  gap: 4,
                })}>
                <AppText numberOfLines={2} style={{ fontWeight: '800', fontSize: 16 }}>
                  {c.name}
                </AppText>
                <AppText style={{ color: tint, fontWeight: '700', fontSize: 13 }}>
                  {t(c.kind === 'annual' ? 'owner.plans.kind.annual' : 'owner.plans.kind.monthly')}
                  {!c.active ? ` · ${t('owner.plans.inactive')}` : ''}
                </AppText>
                <AppText variant="caption" muted>
                  {t('owner.plans.createdOn', { date: new Date(c.createdAt).toLocaleDateString(lang) })}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <PlanCardModal
        target={sheet}
        onClose={() => setSheet(null)}
        onSave={(name, kind) =>
          run(async () => {
            if (sheet !== null && sheet !== 'new') await updateOwnerPlanCard(sheet.id, name, kind);
            else await createOwnerPlanCard(name, kind);
            setSheet(null);
          })
        }
        onToggleActive={(c) =>
          run(async () => {
            await setOwnerPlanCardActive(c.id, !c.active);
            setSheet(null);
          })
        }
        onAskDelete={(c) => {
          setSheet(null);
          setConfirmDelete(c);
        }}
      />

      <ConfirmDialog
        visible={confirmDelete !== null}
        destructive
        title={t('owner.plans.deleteConfirm.title')}
        message={t('owner.plans.deleteConfirm.body', { name: confirmDelete?.name ?? '' })}
        confirmLabel={t('owner.plans.delete')}
        onConfirm={() => {
          const c = confirmDelete;
          setConfirmDelete(null);
          if (c) void run(() => deleteOwnerPlanCard(c.id));
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

/** Create/edit popup — same `<Modal transparent>` shell as `AddManagerModal`. */
function PlanCardModal({
  target,
  onClose,
  onSave,
  onToggleActive,
  onAskDelete,
}: {
  target: 'new' | OwnerPlanCard | null;
  onClose: () => void;
  onSave: (name: string, kind: Kind) => Promise<void>;
  onToggleActive: (card: OwnerPlanCard) => Promise<void>;
  onAskDelete: (card: OwnerPlanCard) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const editing = target !== null && target !== 'new' ? target : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<Kind>(editing?.kind ?? 'monthly');
  const [busy, setBusy] = useState(false);
  const [wasTarget, setWasTarget] = useState(target);

  // Reset the form whenever a different card (or "new") is opened.
  if (target !== wasTarget) {
    setWasTarget(target);
    setName(editing?.name ?? '');
    setKind(editing?.kind ?? 'monthly');
    setBusy(false);
  }

  const canSave = name.trim().length > 0 && !busy;

  async function guarded(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={target !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 460, borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="display" style={{ fontSize: 22 }}>
              {t(editing ? 'owner.plans.edit' : 'owner.plans.new')}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={{ gap: 4 }}>
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {t('owner.plans.name')}
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('owner.plans.namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              maxLength={60}
              autoComplete="off"
              textContentType="none"
              style={{ minHeight: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontSize: 15 }}
            />
          </View>

          <View style={{ gap: 4 }}>
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {t('owner.plans.duration')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['monthly', 'annual'] as const).map((k) => {
                const selected = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      minHeight: MIN_TAP,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.surfaceAlt : 'transparent',
                    }}>
                    <AppText style={{ fontWeight: '700', fontSize: 14, color: selected ? theme.primary : theme.text }}>{t(k === 'annual' ? 'owner.plans.kind.annual' : 'owner.plans.kind.monthly')}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {editing ? (
            <AppText muted style={{ fontSize: 12.5 }}>
              {t('owner.plans.editHelp')}
            </AppText>
          ) : null}

          <Button label={t('owner.plans.save')} onPress={() => void guarded(() => onSave(name.trim(), kind))} disabled={!canSave} />
          {editing ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                label={t(editing.active ? 'owner.plans.deactivate' : 'owner.plans.activate')}
                onPress={() => void guarded(() => onToggleActive(editing))}
                disabled={busy}
              />
              <Button variant="dangerSoft" style={{ flex: 1 }} label={t('owner.plans.delete')} onPress={() => onAskDelete(editing)} disabled={busy} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

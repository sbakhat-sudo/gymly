import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChevronLeftIcon } from '@/components/icons';
import { Toggle } from '@/components/Toggle';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import type { OwnerPlanCard, OwnerPlanCardInput } from './owner-api';

type Kind = OwnerPlanCard['kind'];

/** One colour per card, so each is recognisable at a glance everywhere it shows up (Owner, every
 * Manager, the Client's own plan choice). Fixed hexes read the same in light and dark. */
const CARD_COLORS = ['#8B5CF6', '#EAB308', '#F97316', '#3B82F6', '#EF4444', '#22C55E', '#EC4899', '#14B8A6', '#6366F1', '#64748B'] as const;

/** Create/edit popup — same `<Modal transparent>` shell as `AddManagerModal`. The body scrolls so the
 * form never outgrows a short window; the Save/Disattiva/Elimina actions stay pinned below it. */
export function PlanCardModal({
  target,
  takenColors,
  onClose,
  onSave,
  onToggleActive,
  onAskDelete,
}: {
  target: 'new' | OwnerPlanCard | null;
  /** Colours already used by the Owner's other cards — each card keeps its own. */
  takenColors: (string | null)[];
  onClose: () => void;
  onSave: (input: OwnerPlanCardInput) => Promise<void>;
  onToggleActive: (card: OwnerPlanCard) => Promise<void>;
  onAskDelete: (card: OwnerPlanCard) => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const editing = target !== null && target !== 'new' ? target : null;
  const firstFreeColor: string = CARD_COLORS.find((c) => !takenColors.includes(c)) ?? CARD_COLORS[0];
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<Kind>(editing?.kind ?? 'monthly');
  const [price, setPrice] = useState(editing ? String(editing.priceEur) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [color, setColor] = useState<string>(editing?.color ?? firstFreeColor);
  const [includesCoach, setIncludesCoach] = useState(editing?.includesCoach ?? false);
  const [busy, setBusy] = useState(false);
  const [wasTarget, setWasTarget] = useState(target);

  // Reset the form whenever a different card (or "new") is opened.
  if (target !== wasTarget) {
    setWasTarget(target);
    setName(editing?.name ?? '');
    setKind(editing?.kind ?? 'monthly');
    setPrice(editing ? String(editing.priceEur) : '');
    setDescription(editing?.description ?? '');
    setColor(editing?.color ?? firstFreeColor);
    setIncludesCoach(editing?.includesCoach ?? false);
    setBusy(false);
  }

  const priceValue = Number(price.replace(',', '.'));
  const priceOk = price.trim().length > 0 && Number.isFinite(priceValue) && priceValue >= 0;
  const canSave = name.trim().length > 0 && priceOk && !busy;
  const createdAt = editing ? new Date(editing.createdAt) : new Date();

  async function guarded(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { minHeight: MIN_TAP, borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: theme.text, fontSize: 15 } as const;

  return (
    <Modal visible={target !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 460, maxHeight: '92%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="display" style={{ fontSize: 22 }}>
              {t(editing ? 'owner.plans.edit' : 'owner.plans.new')}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                style={inputStyle}
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

            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('owner.plans.price')}
              </AppText>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={9}
                autoComplete="off"
                textContentType="none"
                style={inputStyle}
              />
            </View>

            <View style={{ gap: 4 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('owner.plans.description')}
              </AppText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('owner.plans.descriptionPlaceholder')}
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={300}
                autoComplete="off"
                textContentType="none"
                style={{ ...inputStyle, minHeight: 88, paddingTop: spacing.sm, textAlignVertical: 'top' }}
              />
              <AppText muted style={{ fontSize: 12 }}>
                {t('owner.plans.descriptionHelp')}
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: theme.border }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontWeight: '700', fontSize: 14 }}>{t('plan.coach.label')}</AppText>
                <AppText muted style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {t('plan.coach.help')}
                </AppText>
              </View>
              <Toggle value={includesCoach} onValueChange={setIncludesCoach} accessibilityLabel={t('plan.coach.label')} />
            </View>

            <View style={{ gap: 6 }}>
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {t('owner.plans.color')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CARD_COLORS.map((c) => {
                  const taken = takenColors.includes(c);
                  const selected = color === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      disabled={taken}
                      accessibilityRole="button"
                      accessibilityLabel={t(taken ? 'owner.plans.colorTaken' : 'owner.plans.color')}
                      accessibilityState={{ selected, disabled: taken }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: c,
                        opacity: taken ? 0.25 : 1,
                        borderWidth: 3,
                        borderColor: selected ? theme.text : 'transparent',
                      }}
                    />
                  );
                })}
              </View>
              <AppText muted style={{ fontSize: 12 }}>
                {t('owner.plans.colorHelp')}
              </AppText>
            </View>

            <AppText muted style={{ fontSize: 12.5 }}>
              {t('owner.plans.createdOn', { date: createdAt.toLocaleDateString(lang) })}
            </AppText>
            {editing ? (
              <AppText muted style={{ fontSize: 12.5 }}>
                {t('owner.plans.editHelp')}
              </AppText>
            ) : null}
          </ScrollView>

          <Button
            label={t('owner.plans.save')}
            onPress={() => void guarded(() => onSave({ name: name.trim(), kind, priceEur: priceValue, description: description.trim() || null, color, includesCoach }))}
            disabled={!canSave}
          />
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

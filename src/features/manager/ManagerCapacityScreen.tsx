import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { GearIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { RangeSlider } from '@/components/RangeSlider';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/lib/auth/auth-context';
import { useLiveGymBand, usePolledSiteStatus, type SiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { getPresentPeople, getSiteStatus, setCapacitySettings } from './manager-api';

interface Draft {
  capacity: number;
  greenPct: number;
  amberPct: number;
  notify: boolean;
}

function draftFromStatus(s: SiteStatus): Draft {
  return { capacity: s.capacityReference, greenPct: s.bandGreenPct, amberPct: s.bandAmberPct, notify: s.notifyOnThreshold };
}

const DEFAULT_GREEN_PCT = 40;
const DEFAULT_AMBER_PCT = 75;

/** ≈ how many people a given percentage of capacity is — shown next to each threshold so a
 * percentage ("30%") still reads concretely for this one gym, without the thresholds themselves
 * being tied to a headcount (see the migration — the Manager explicitly asked for percentages, not
 * an absolute count, so this is display-only context, never what's actually stored or compared). */
function approxPeople(pct: number, capacity: number): number {
  return Math.round((pct / 100) * capacity);
}

/**
 * The Manager's own PERCENTAGE-of-capacity thresholds for the live occupancy band (`get_live_band`
 * reads `band_green_pct`/`band_amber_pct` straight off `sites`, see the migration). This screen only
 * ever renders on web (Manager is a web-only role), so the sliders below use real
 * `<input type="range">` controls — same precedent as `ManagerGymScreen.tsx`'s `TimeField` using a
 * raw `<input type="time">`.
 */
export function ManagerCapacityScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'invalid' | 'error' | null>(null);
  const [presentCount, setPresentCount] = useState<number | null>(null);

  function load(): void {
    if (!siteId) return;
    getSiteStatus(siteId).then(
      (s) => setDraft(draftFromStatus(s)),
      () => setLoadError(true)
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Live band chip — same polling pattern as ManagerSituationScreen.
  const appActive = useAppActive();
  const now = useNow(30_000, appActive);
  const { site: polledSite } = usePolledSiteStatus(siteId);
  const liveBand = useLiveGymBand(polledSite, siteId, now);

  // The headcount next to the chip is kept just as live as the band itself — re-read on the same
  // 30s tick, not just once on mount, otherwise the number would sit stale while the colour updates.
  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    getPresentPeople(siteId)
      .then((people) => alive && setPresentCount(people.filter((p) => p.kind === 'client').length))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [siteId, now]);

  if (loadError) {
    return (
      <Screen>
        <Banner title={t('manager.capacity.loadError')} />
      </Screen>
    );
  }
  if (!draft) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }

  async function save(): Promise<void> {
    if (!siteId || !draft) return;
    setFeedback(null);
    if (!(draft.capacity >= 1 && draft.greenPct > 0 && draft.greenPct < draft.amberPct && draft.amberPct <= 100)) {
      setFeedback('invalid');
      return;
    }
    setSaving(true);
    try {
      await setCapacitySettings(siteId, { capacityReference: draft.capacity, bandGreenPct: draft.greenPct, bandAmberPct: draft.amberPct, notifyOnThreshold: draft.notify });
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults(): void {
    if (!draft) return;
    setDraft({ ...draft, greenPct: DEFAULT_GREEN_PCT, amberPct: DEFAULT_AMBER_PCT });
    setFeedback(null);
  }

  function cancel(): void {
    setFeedback(null);
    load();
  }

  return (
    <Screen onRefresh={load} refreshing={false}>
      <View style={{ paddingTop: spacing.xxl, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <BackButton href="/(manager)/apertura" />
          {liveBand ? (
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: theme.band[liveBand].soft }}>
              <AppText color={theme.band[liveBand].onSoft} style={{ fontWeight: '700', fontSize: 12.5 }}>
                {t('manager.capacity.status.label')}: {presentCount !== null ? t('manager.capacity.status.people', { n: presentCount }) : '—'}
              </AppText>
            </View>
          ) : null}
        </View>
        <PageTitle icon={GearIcon} label={t('manager.capacity.title')} />
        <AppText muted style={{ fontSize: 14 }}>
          {t('manager.capacity.subtitle')}
        </AppText>
      </View>

      <Card>
        <SectionTitle>{t('manager.capacity.settings.title')}</SectionTitle>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText style={{ fontWeight: '700' }}>{t('manager.capacity.max.title')}</AppText>
            <NumberField value={draft.capacity} suffix={null} min={1} max={2000} onChange={(v) => setDraft({ ...draft, capacity: v })} accessibilityLabel={t('manager.capacity.max.title')} />
          </View>
          <AppText variant="caption" muted>
            {t('manager.capacity.max.help')}
          </AppText>
          <ReadoutPill label={t('manager.capacity.max.readout', { n: draft.capacity })} color={theme.primary} onColor={theme.onPrimary} />
          <RangeSlider
            value={draft.capacity}
            min={1}
            max={Math.max(draft.capacity, 200)}
            color={theme.primary}
            accessibilityLabel={t('manager.capacity.max.title')}
            onChange={(v) => setDraft({ ...draft, capacity: v })}
          />
          <SliderTicks min={0} max={Math.max(draft.capacity, 200)} />
        </View>

        <SectionTitle>{t('manager.capacity.thresholds.title')}</SectionTitle>
        <AppText variant="caption" muted>
          {t('manager.capacity.thresholds.help')}
        </AppText>

        <ThresholdRow
          dotColor={theme.band.green.solid}
          label={t('manager.capacity.green.label')}
          rangeLabel={t('manager.capacity.green.range', { n: draft.greenPct })}
          help={t('manager.capacity.green.help')}
          approx={t('manager.capacity.approx', { n: approxPeople(draft.greenPct, draft.capacity) })}
          field={
            <NumberField
              value={draft.greenPct}
              suffix="%"
              min={1}
              max={99}
              onChange={(v) => setDraft({ ...draft, greenPct: Math.max(1, Math.min(v, draft.amberPct - 1)) })}
              accessibilityLabel={t('manager.capacity.green.label')}
            />
          }>
          <RangeSlider
            value={draft.greenPct}
            min={0}
            max={100}
            color={theme.band.green.solid}
            accessibilityLabel={t('manager.capacity.green.label')}
            onChange={(v) => setDraft({ ...draft, greenPct: Math.max(1, Math.min(v, draft.amberPct - 1)) })}
          />
          <SliderTicks min={0} max={100} unit="%" />
        </ThresholdRow>

        <ThresholdRow
          dotColor={theme.band.amber.solid}
          label={t('manager.capacity.amber.label')}
          rangeLabel={t('manager.capacity.amber.range', { a: draft.greenPct, b: draft.amberPct })}
          help={t('manager.capacity.amber.help')}
          approx={t('manager.capacity.approxRange', { a: approxPeople(draft.greenPct, draft.capacity), b: approxPeople(draft.amberPct, draft.capacity) })}>
          {/* Derived, not independently settable — "everything between the green and red
              thresholds". Green and Red are the two percentages the Manager actually sets; Yellow is
              just what's left in between, same honest "computed, not editable" pattern used below
              for Red before the Manager asked for an independent red threshold too. */}
          <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.band.amber.soft, overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ flex: draft.greenPct }} />
            <View style={{ flex: Math.max(draft.amberPct - draft.greenPct, 0.0001), backgroundColor: theme.band.amber.solid }} />
            <View style={{ flex: Math.max(100 - draft.amberPct, 0.0001) }} />
          </View>
          <SliderTicks min={0} max={100} unit="%" />
        </ThresholdRow>

        <ThresholdRow
          dotColor={theme.band.red.solid}
          label={t('manager.capacity.red.label')}
          rangeLabel={t('manager.capacity.red.range', { n: draft.amberPct })}
          help={t('manager.capacity.red.help')}
          approx={t('manager.capacity.approx', { n: approxPeople(draft.amberPct, draft.capacity) })}
          field={
            <NumberField
              value={draft.amberPct}
              suffix="%"
              min={2}
              max={100}
              onChange={(v) => setDraft({ ...draft, amberPct: Math.min(100, Math.max(v, draft.greenPct + 1)) })}
              accessibilityLabel={t('manager.capacity.red.label')}
            />
          }>
          <RangeSlider
            value={draft.amberPct}
            min={0}
            max={100}
            color={theme.band.red.solid}
            accessibilityLabel={t('manager.capacity.red.label')}
            onChange={(v) => setDraft({ ...draft, amberPct: Math.min(100, Math.max(v, draft.greenPct + 1)) })}
          />
          <SliderTicks min={0} max={100} unit="%" />
        </ThresholdRow>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: '700' }}>{t('manager.capacity.notify.title')}</AppText>
            <AppText variant="caption" muted>
              {t('manager.capacity.notify.help')}
            </AppText>
          </View>
          <Toggle value={draft.notify} onValueChange={(v) => setDraft({ ...draft, notify: v })} accessibilityLabel={t('manager.capacity.notify.title')} />
        </View>

        {feedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={feedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(feedback === 'saved' ? 'manager.capacity.saved' : feedback === 'invalid' ? 'manager.capacity.invalid' : 'manager.capacity.error')}
            </AppText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button label={t('manager.capacity.reset')} variant="secondary" onPress={resetDefaults} style={{ flexGrow: 1 }} />
          <Button label={t('manager.capacity.cancel')} variant="secondary" onPress={cancel} style={{ flexGrow: 1 }} />
          <Button label={t('manager.capacity.save')} onPress={() => void save()} disabled={saving} style={{ flexGrow: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

function ReadoutPill({ label, color, onColor }: { label: string; color: string; onColor: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color }}>
      <AppText color={onColor} style={{ fontWeight: '700', fontSize: 13 }}>
        {label}
      </AppText>
    </View>
  );
}

function ThresholdRow({
  dotColor,
  label,
  rangeLabel,
  help,
  approx,
  field,
  children,
}: {
  dotColor: string;
  label: string;
  rangeLabel: string;
  help: string;
  approx: string;
  field?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
          <AppText style={{ fontWeight: '700' }}>{label}</AppText>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: `${dotColor}22` }}>
            <AppText style={{ fontSize: 12, fontWeight: '700', color: dotColor }}>{rangeLabel}</AppText>
          </View>
        </View>
        {field}
      </View>
      <AppText variant="caption" muted>
        {help} · {approx}
      </AppText>
      {children}
    </View>
  );
}

function SliderTicks({ min, max, unit = '' }: { min: number; max: number; unit?: string }) {
  const mid = Math.round((min + max) / 2);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="caption" muted>
        {min}
        {unit}
      </AppText>
      <AppText variant="caption" muted>
        {mid}
        {unit}
      </AppText>
      <AppText variant="caption" muted>
        {max}
        {unit}
      </AppText>
    </View>
  );
}

/** The typed input the Manager asked for alongside each slider — dragging is quick, typing is
 * precise; both write the same draft value. */
function NumberField({
  value,
  suffix,
  min,
  max,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  suffix: string | null;
  min: number;
  max: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(value));
  // Render-time "adjust state" (not a setState-in-effect, which this project's React Compiler
  // config rejects): when the slider (or a sibling field's clamp) changes `value` externally, the
  // edit buffer must catch up in the same render, not one tick later — same pattern as
  // `gym-status.ts`'s `useLiveGymBand`.
  const [trackedValue, setTrackedValue] = useState(value);
  if (value !== trackedValue) {
    setTrackedValue(value);
    setText(String(value));
  }

  function commit(raw: string): void {
    const n = Number(raw.replace(/[^0-9]/g, ''));
    if (Number.isFinite(n) && raw.trim() !== '') {
      onChange(Math.max(min, Math.min(max, n)));
    } else {
      setText(String(value));
    }
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        keyboardType="number-pad"
        accessibilityLabel={accessibilityLabel}
        style={{
          minWidth: 52,
          minHeight: MIN_TAP - 8,
          textAlign: 'center',
          borderWidth: 1.5,
          borderColor: theme.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          color: theme.text,
          fontSize: 14,
          fontWeight: '700',
        }}
      />
      {suffix ? <AppText muted>{suffix}</AppText> : null}
    </View>
  );
}


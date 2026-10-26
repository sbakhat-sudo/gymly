import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ClockIcon } from '@/components/icons';
import { BandChip } from '@/features/orari/BandChip';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

const ORDER: Record<Band, number> = { green: 0, amber: 1, red: 2 };

export type PastState = { kind: 'band'; band: Band } | { kind: 'closed' } | { kind: 'noData' };

export interface RecentHour {
  /** "11:00" */
  label: string;
  state: PastState;
}

/**
 * "Le ultime ore": how the gym was in each of the last two hours, then how it is now — at 13:00 it shows 11:00, 12:00
 * and "Adesso" side by side, plus the change in words (si sta svuotando / riempiendo / stabile). Only the state of
 * the gym, never a number of people.
 */
export function RecentHoursCard({ hours, nowBand }: { hours: readonly RecentHour[]; nowBand: Band | null }) {
  const { t } = useI18n();
  const theme = useTheme();

  const first = hours.find((h) => h.state.kind === 'band')?.state;
  const trend =
    first && first.kind === 'band' && nowBand
      ? ORDER[nowBand] < ORDER[first.band]
        ? t('home.client.ago.emptier')
        : ORDER[nowBand] > ORDER[first.band]
          ? t('home.client.ago.fuller')
          : t('home.client.ago.same')
      : null;

  const column = (key: string, label: string, content: React.ReactNode, highlight = false) => (
    <View
      key={key}
      style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderRadius: radius.lg, backgroundColor: theme.surfaceAlt, borderWidth: highlight ? 2 : 1, borderColor: highlight ? theme.primary : theme.border }}>
      <AppText style={{ fontWeight: '800', fontSize: 14, color: highlight ? theme.primary : theme.text }}>{label}</AppText>
      {content}
    </View>
  );

  const stateContent = (state: PastState) =>
    state.kind === 'band' ? (
      <BandChip band={state.band} size="sm" />
    ) : (
      <AppText muted style={{ fontSize: 12.5, textAlign: 'center' }}>
        {t(state.kind === 'closed' ? 'home.client.ago.closed' : 'home.client.ago.noData')}
      </AppText>
    );

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary + '18' }}>
          <ClockIcon color={theme.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('home.client.ago.label')}
          </AppText>
          <AppText muted style={{ fontSize: 13 }}>
            {t('home.client.ago.hint')}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {hours.map((h) => column(h.label, h.label, stateContent(h.state)))}
        {column('now', t('home.client.ago.now'), nowBand ? <BandChip band={nowBand} size="sm" /> : <AppText muted style={{ fontSize: 12.5 }}>—</AppText>, true)}
      </View>

      {trend ? <AppText style={{ fontWeight: '700', fontSize: 13.5 }}>{trend}</AppText> : null}
    </View>
  );
}

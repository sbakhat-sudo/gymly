import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { radius, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { ChevronLeftIcon, ChevronRightIcon, SortIcon } from './icons';

type IconType = (p: { color: string; size: number }) => ReactElement;

/** A table's own column header cell — shared by every Manager list table (Segnalazioni, Feedback,
 * …) so they all line up the same way instead of each screen hand-rolling its own header row. */
export function HeaderCell({ flex, label, sortable = false, align = 'left' }: { flex: number; label: string; sortable?: boolean; align?: 'left' | 'right' }) {
  const theme = useTheme();
  return (
    <View style={{ flex, flexDirection: 'row', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4 }}>
      <AppText variant="caption" muted numberOfLines={1} style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 11 * 0.05 }}>
        {label}
      </AppText>
      {sortable ? <SortIcon color={theme.textMuted} size={11} /> : null}
    </View>
  );
}

/** Keeps the page-number row short even with many pages: all of them up to 7, otherwise the current
 * one with a neighbour on each side plus the two ends, "…" filling the gaps — the same shape most
 * pagination controls settle on, just computed instead of hand-picked per screenshot. */
function pageNumbers(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const set = new Set([0, count - 1, current, current - 1, current + 1].filter((n) => n >= 0 && n < count));
  const sorted = [...set].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] ?? n) > 1) result.push(null);
    result.push(n);
  });
  return result;
}

function PageArrow({ disabled, onPress, icon: Icon, label }: { disabled: boolean; onPress: () => void; icon: IconType; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Icon color={theme.text} size={16} />
    </Pressable>
  );
}

/** Numbered page row + prev/next arrows — shared by every Manager list table. `nextLabel` is the
 * only thing that varies (each screen's own "Pagina successiva" accessibility string already
 * mentions what it's a page of, e.g. "…di segnalazioni" vs "…di feedback"). */
export function Pagination({ page, pageCount, onChange, nextLabel }: { page: number; pageCount: number; onChange: (p: number) => void; nextLabel: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const numbers = pageNumbers(page, pageCount);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <PageArrow disabled={page === 0} onPress={() => onChange(page - 1)} icon={ChevronLeftIcon} label={t('common.back')} />
      {numbers.map((n, i) =>
        n === null ? (
          <AppText key={`ellipsis-${i}`} muted style={{ paddingHorizontal: 4, fontSize: 13 }}>
            …
          </AppText>
        ) : (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: n === page }}
            accessibilityLabel={`${n + 1}`}
            style={{
              minWidth: 32,
              height: 32,
              paddingHorizontal: 6,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: n === page ? theme.text : 'transparent',
            }}>
            <AppText color={n === page ? theme.background : theme.text} style={{ fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {n + 1}
            </AppText>
          </Pressable>
        )
      )}
      <PageArrow disabled={page >= pageCount - 1} onPress={() => onChange(page + 1)} icon={ChevronRightIcon} label={nextLabel} />
    </View>
  );
}

import { Pressable, View } from 'react-native';

import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

/** One labelled group of selectable chips, meant to live inside a single "Filtri" `ActionSheet` —
 * shared by the Manager's Issues table, the Manager's Feedback list and the Client's Feedback tab,
 * so all three keep the exact same "one sheet, several chip groups" filter pattern instead of each
 * screen growing its own near-identical copy. */
export function FilterGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" muted style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 11 * 0.05 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              style={{
                minHeight: MIN_TAP,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.text : theme.surfaceAlt,
              }}>
              <AppText color={selected ? theme.background : theme.text} style={{ fontSize: 13.5, fontWeight: '700' }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The always-visible chip summarising one active (or default) filter, tappable to reopen the shared
 * "Filtri" sheet — filled when that filter is non-default, outlined otherwise. */
export function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 34,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: active ? theme.primary : theme.surface,
        borderWidth: active ? 0 : 1.5,
        borderColor: theme.border,
      }}>
      <AppText color={active ? theme.onPrimary : theme.text} style={{ fontSize: 13, fontWeight: '700' }}>
        {label}
      </AppText>
      <AppText color={active ? theme.onPrimary : theme.textMuted} style={{ fontSize: 10, fontWeight: '700', marginTop: 1 }}>
        ▾
      </AppText>
    </Pressable>
  );
}

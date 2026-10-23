import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { ChevronRightIcon, MapPinIcon, PlusIcon } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import { fontFamily, MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/**
 * The one look every role's Impostazioni shares: a profile card on top, then titled groups whose rows sit in a
 * single rounded card separated by hairlines — instead of a pile of identical white cards each with a tiny
 * label. Rows have an icon tile, a bold label and (optionally) a value or a control on the right, so what each
 * line is and what it does reads at a glance.
 */

/** A titled group: small caps title above, then one card holding every row, with a hairline between them. */
export function SettingsGroup({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <AppText accessibilityRole="header" style={{ paddingHorizontal: 6, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, color: theme.textMuted }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={{ height: 1, marginLeft: 64, backgroundColor: theme.border }} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {hint ? (
        <AppText variant="caption" muted style={{ paddingHorizontal: 6, lineHeight: 17 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** The small rounded-square icon every row starts with. */
export function SettingsIcon({ icon: Icon, tint }: { icon: IconType; tint?: string }) {
  const theme = useTheme();
  const color = tint ?? theme.primary;
  return (
    <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}1F` }}>
      <Icon color={color} size={19} />
    </View>
  );
}

/** One line of a group: icon tile, label, and an optional value / right-hand control / chevron when tappable. */
export function SettingsRow({
  icon,
  tint,
  label,
  subtitle,
  value,
  onPress,
  right,
  destructive = false,
  chevron = true,
  role = 'button',
  selected,
  a11yLabel,
}: {
  icon: IconType;
  tint?: string;
  label: string;
  /** A second, smaller line under the label (an address, a hint). */
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  /** Show the › on a tappable row (off for a choice list, where the right-hand side is the selection mark). */
  chevron?: boolean;
  role?: 'button' | 'radio';
  selected?: boolean;
  /** Overrides the spoken name (default: the label, plus the value when there is one). */
  a11yLabel?: string;
}) {
  const theme = useTheme();
  const color = destructive ? theme.danger : undefined;
  const content = (
    <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <SettingsIcon icon={icon} tint={destructive ? theme.danger : tint} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText style={{ fontSize: 15, fontWeight: '600', color }} numberOfLines={1}>
          {label}
        </AppText>
        {subtitle ? (
          <AppText muted style={{ fontSize: 12.5, lineHeight: 16 }} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText muted numberOfLines={1} style={{ fontSize: 14, flexShrink: 1, maxWidth: '46%', textAlign: 'right' }}>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress && chevron ? <ChevronRightIcon color={theme.textMuted} size={16} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={selected === undefined ? undefined : { selected, checked: selected }}
      accessibilityLabel={a11yLabel ?? (value ? `${label}: ${value}` : label)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

/** A row whose control is a segmented switch under its label (language, theme…), so the options get the full width. */
export function SettingsChoiceRow<T extends string>({
  icon,
  tint,
  label,
  value,
  onChange,
  options,
  help,
}: {
  icon: IconType;
  tint?: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  help?: string;
}) {
  return (
    <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <SettingsIcon icon={icon} tint={tint} />
        <AppText style={{ flex: 1, fontSize: 15, fontWeight: '600' }}>{label}</AppText>
      </View>
      <Segmented<T> label={label} value={value} onChange={onChange} options={options} />
      {help ? (
        <AppText variant="caption" muted style={{ lineHeight: 17 }}>
          {help}
        </AppText>
      ) : null}
    </View>
  );
}

/** Padding for free-form content (inputs, buttons) placed inside a group instead of a row. */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <View style={{ gap: spacing.sm, padding: spacing.md }}>{children}</View>;
}

/**
 * The profile card on top of every Impostazioni: a big photo (tap to change it) over a soft band, the name,
 * and chips for the role and the gym — with the sign-in email underneath. Presentational: the screen passes
 * what to show and what a tap on the photo does.
 */
export function SettingsHero({
  name,
  roleLabel,
  gymName,
  email,
  avatarUri,
  onChangePhoto,
  uploading = false,
  notice,
}: {
  name: string | null;
  roleLabel: string;
  gymName?: string | null;
  email?: string | null;
  avatarUri?: string | null;
  onChangePhoto?: () => void;
  uploading?: boolean;
  notice?: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
      <View style={{ height: 84, backgroundColor: `${theme.primary}26` }} />
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, marginTop: -48 }}>
        <Pressable
          onPress={onChangePhoto}
          disabled={!onChangePhoto || uploading}
          accessibilityRole="button"
          accessibilityLabel={onChangePhoto ? 'Foto del profilo' : undefined}
          style={{ width: 96, height: 96 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: theme.surface, overflow: 'hidden' }}>
            <Avatar uri={avatarUri} name={name} size={88} />
          </View>
          {onChangePhoto ? (
            <View style={{ position: 'absolute', right: 0, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, borderWidth: 3, borderColor: theme.surface }}>
              <PlusIcon color={theme.onPrimary} size={14} strokeWidth={2.8} />
            </View>
          ) : null}
        </Pressable>

        <AppText accessibilityRole="header" style={{ fontFamily: fontFamily.displaySemi, fontSize: 22, lineHeight: 27, letterSpacing: 22 * -0.03, textAlign: 'center' }} numberOfLines={2}>
          {name || '—'}
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
          <View style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: `${theme.primary}1F` }}>
            <AppText style={{ color: theme.primary, fontWeight: '700', fontSize: 12.5 }}>{roleLabel}</AppText>
          </View>
          {gymName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
              <MapPinIcon color={theme.textMuted} size={13} />
              <AppText style={{ fontWeight: '600', fontSize: 12.5 }} numberOfLines={1}>
                {gymName}
              </AppText>
            </View>
          ) : null}
        </View>

        {email ? (
          <AppText muted style={{ fontSize: 13 }} numberOfLines={1}>
            {email}
          </AppText>
        ) : null}

        {uploading ? (
          <AppText muted style={{ fontSize: 12 }}>
            …
          </AppText>
        ) : null}
        {notice ? (
          <AppText color={theme.danger} style={{ fontSize: 12.5, fontWeight: '600', textAlign: 'center' }}>
            {notice}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** A text input styled for the inside of a group. */
export function settingsInputStyle(theme: ReturnType<typeof useTheme>, invalid = false) {
  return {
    minHeight: MIN_TAP + 2,
    borderWidth: 1.5,
    borderColor: invalid ? theme.danger : theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    backgroundColor: theme.background,
    fontFamily: fontFamily.body,
    fontSize: 15,
  } as const;
}

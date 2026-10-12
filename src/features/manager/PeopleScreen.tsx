import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EyeIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { formatShortDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { createMember, deletePerson, getRoster, setPersonStatus, type NewMember, type RosterEntry } from './manager-api';

export function PeopleScreen() {
  const { t, lang } = useI18n();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const roster = useAsync(() => (siteId ? getRoster(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  const coaches = roster.data?.filter((r) => r.role === 'coach') ?? [];
  const clients = roster.data?.filter((r) => r.role === 'client') ?? [];

  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetPerson, setSheetPerson] = useState<RosterEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RosterEntry | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  async function toggleStatus(person: RosterEntry): Promise<void> {
    setBusyId(person.userId);
    try {
      await setPersonStatus(person.userId, person.status === 'active' ? 'rejected' : 'active');
      roster.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleteError(false);
    try {
      await deletePerson(deleteTarget.userId);
      setDeleteTarget(null);
      roster.reload();
    } catch {
      setDeleteError(true);
    }
  }

  function exportCsv(): void {
    if (!roster.data) return;
    const header = [
      t('manager.people.col.name'),
      t('manager.requests.col.role'),
      t('manager.people.col.phone'),
      t('manager.people.col.status'),
      t('manager.people.col.activated'),
      t('manager.people.col.deactivated'),
    ];
    const rows = roster.data.map((p) => [
      p.fullName ?? t('common.unnamedPerson'),
      t(p.role === 'coach' ? 'manager.requests.role.coach' : 'manager.requests.role.client'),
      p.phone ?? '',
      t(p.status === 'active' ? 'manager.people.col.status.active' : 'manager.people.col.status.inactive'),
      p.activatedAt ? formatShortDate(lang, p.activatedAt) : '',
      p.deactivatedAt ? formatShortDate(lang, p.deactivatedAt) : '',
    ]);
    const escape = (cell: string): string => `"${cell.replace(/"/g, '""')}"`;
    // A leading UTF-8 BOM, or Excel renders accented characters (à, è, ò…) as garbled text.
    const csv = '﻿' + [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('manager.people.title').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen onRefresh={roster.reload} refreshing={roster.loading && roster.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('manager.people.title')}
        </AppText>
        {roster.data && roster.data.length > 0 ? <Button label={t('manager.people.export')} variant="secondary" onPress={exportCsv} /> : null}
      </View>

      {roster.error ? <Banner title={t('manager.people.error')} /> : null}
      {roster.data === undefined && roster.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {deleteError ? <Banner title={t('manager.people.delete.error')} /> : null}

      {roster.data ? (
        <>
          <RosterPanel title={t('manager.people.coaches')} people={coaches} onOpenSheet={setSheetPerson} addRole="coach" onCreated={roster.reload} />
          <RosterPanel title={t('manager.people.clients')} people={clients} onOpenSheet={setSheetPerson} addRole="client" onCreated={roster.reload} />
        </>
      ) : null}

      <ActionSheet
        visible={sheetPerson !== null}
        title={sheetPerson?.fullName ?? t('common.unnamedPerson')}
        actions={[
          {
            label: t(sheetPerson?.status === 'rejected' ? 'manager.people.reactivate' : 'manager.people.deactivate'),
            disabled: busyId === sheetPerson?.userId,
            onPress: () => {
              if (sheetPerson) void toggleStatus(sheetPerson);
              setSheetPerson(null);
            },
          },
          {
            label: t('manager.people.delete'),
            destructive: true,
            onPress: () => {
              setDeleteTarget(sheetPerson);
              setSheetPerson(null);
            },
          },
        ]}
        onClose={() => setSheetPerson(null)}
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        destructive
        title={t('manager.people.delete.confirm.title')}
        message={t('manager.people.delete.confirm.message', { name: deleteTarget?.fullName ?? t('common.unnamedPerson') })}
        confirmLabel={t('manager.people.delete.confirm.action')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Screen>
  );
}

/** One role's panel: a header bar (icon, title, headcount) over a flat row list — name + role
 * pill, eye button — closed by a centered "Aggiungi" action, modelled after a dense roster table
 * rather than the app's usual stack of individually-rounded cards. */
function RosterPanel({
  title,
  people,
  onOpenSheet,
  addRole,
  onCreated,
}: {
  title: string;
  people: RosterEntry[];
  onOpenSheet: (person: RosterEntry) => void;
  addRole: 'coach' | 'client';
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.surfaceAlt,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <UsersIcon color={theme.text} size={18} />
          <AppText style={{ fontWeight: '700' }}>{title}</AppText>
        </View>
        <AppText variant="caption" muted>
          {t('manager.people.count', { n: people.length })}
        </AppText>
      </View>

      {people.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.md }}>
          <AppText variant="caption" muted style={{ flex: 2, fontWeight: '700', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.4 }}>
            {t('manager.people.col.name')}
          </AppText>
          <AppText variant="caption" muted style={{ flex: 1.3, fontWeight: '700', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.4 }}>
            {t('manager.people.col.phone')}
          </AppText>
          <AppText variant="caption" muted style={{ flex: 1, fontWeight: '700', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.4 }}>
            {t('manager.people.col.activated')}
          </AppText>
          <AppText variant="caption" muted style={{ flex: 1, fontWeight: '700', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.4 }}>
            {t('manager.people.col.deactivated')}
          </AppText>
          <View style={{ width: MIN_TAP }} />
        </View>
      ) : null}

      {people.length === 0 ? (
        <View style={{ padding: spacing.md }}>
          <AppText variant="caption" muted>
            {t('manager.people.empty')}
          </AppText>
        </View>
      ) : (
        people.map((p, i) => <PersonRow key={p.userId} person={p} last={i === people.length - 1} onOpenSheet={onOpenSheet} />)
      )}

      <View style={{ padding: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border }}>
        <AddMemberPanel role={addRole} onCreated={onCreated} />
      </View>
    </View>
  );
}

// Fixed per-role fills (not theme primary/accent): the Manager asked for these two specific colours
// so the row itself reads as "this person's role" at a glance, same idea as a coloured tag but
// filling the whole line instead of a small badge — purple for Coach, the brand's own orange-red
// for Client (already AA-tested against white as `onAccent`, so Client reuses it instead of a new
// ad-hoc colour).
const COACH_COLOR = '#7C4DFF';
const COACH_ON_COLOR = '#FFFFFF';

/** One roster row, filled edge-to-edge with the role's colour, laid out in the same columns as the
 * panel's header above it (name, phone, activated, deactivated) — and an eye button that opens the
 * actions sheet (activate/deactivate, delete), a Manager's one entry point to manage someone
 * without deleting their history by accident. */
function PersonRow({ person, last, onOpenSheet }: { person: RosterEntry; last: boolean; onOpenSheet: (person: RosterEntry) => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const isCoach = person.role === 'coach';
  const rowBg = isCoach ? COACH_COLOR : theme.accent;
  const onRowColor = isCoach ? COACH_ON_COLOR : theme.onAccent;
  const isActive = person.status === 'active';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        backgroundColor: rowBg,
        opacity: isActive ? 1 : 0.6,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.background,
      }}>
      <AppText numberOfLines={1} color={onRowColor} style={{ flex: 2, fontWeight: '700' }}>
        {person.fullName ?? t('common.unnamedPerson')}
      </AppText>
      <AppText numberOfLines={1} color={onRowColor} style={{ flex: 1.3, fontSize: 13, opacity: 0.9 }}>
        {person.phone ?? '—'}
      </AppText>
      <AppText numberOfLines={1} color={onRowColor} style={{ flex: 1, fontSize: 13, opacity: 0.9 }}>
        {person.activatedAt ? formatShortDate(lang, person.activatedAt) : '—'}
      </AppText>
      <AppText numberOfLines={1} color={onRowColor} style={{ flex: 1, fontSize: 13, opacity: 0.9 }}>
        {person.deactivatedAt && !isActive ? formatShortDate(lang, person.deactivatedAt) : '—'}
      </AppText>
      <Pressable
        onPress={() => onOpenSheet(person)}
        accessibilityRole="button"
        accessibilityLabel={t('manager.people.actions', { name: person.fullName ?? t('common.unnamedPerson') })}
        style={{
          width: MIN_TAP,
          height: MIN_TAP,
          borderRadius: MIN_TAP / 2,
          backgroundColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <EyeIcon color={onRowColor} size={18} />
      </Pressable>
    </View>
  );
}

/** Only digits: wa.me needs the phone as a plain international number, no `+`/spaces/dashes. */
function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * `Linking.openURL` on web navigates the current tab away to wa.me, replacing the whole app (and,
 * since the URL used to carry `?text=...Password: XXXX`, left the password sitting in that tab's
 * browser history). This screen only ever renders on web (Manager is a web-only role), so
 * `window.open` is always available here — opens WhatsApp in a new tab/app instead, same as any
 * ordinary link, and leaves Gymly's own tab untouched. Native (Coach/Client apps) keeps `Linking`.
 */
function openExternalUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(url);
}

/**
 * Toggle button that expands into name/email/phone fields: creates the account right away (the
 * Manager never sees or picks the password — it's generated here) and opens WhatsApp with it ready
 * to send. The password itself is never put in the WhatsApp message/URL (see `openExternalUrl`'s
 * comment on why that used to leak into browser history) — it's shown here instead, with a "Copia"
 * button, so the Manager relays it through a separate channel of their choosing.
 */
function AddMemberPanel({ role, onCreated }: { role: 'coach' | 'client'; onCreated: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [created, setCreated] = useState<NewMember | null>(null);
  const [copied, setCopied] = useState(false);

  const inputStyle = {
    minHeight: MIN_TAP,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontSize: 15,
  } as const;

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit(): Promise<void> {
    if (!emailLooksValid) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const member: NewMember = await createMember(role, name, email, phone);
      const appLink = Linking.createURL('/');
      const message = t('manager.people.invite.message', { name: name.trim() || t('common.unnamedPerson'), email: member.email, link: appLink });
      openExternalUrl(`https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(message)}`);
      setCreated(member);
      onCreated();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword(): Promise<void> {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort — the password is also shown as selectable text right next to the button.
    }
  }

  function toggle(): void {
    setOpen(!open);
    setName('');
    setEmail('');
    setPhone('');
    setError(false);
    setCreated(null);
    setCopied(false);
  }

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && sanitizePhone(phone).length > 0;

  return (
    <View>
      <Button label={t(role === 'coach' ? 'manager.people.invite.coach' : 'manager.people.invite.client')} variant="secondary" onPress={toggle} />
      {open ? (
        <Card style={{ marginTop: spacing.sm }}>
          <AppText variant="caption" muted>
            {t('manager.people.invite.help')}
          </AppText>

          {created ? (
            <View style={{ gap: spacing.sm }}>
              <AppText style={{ color: theme.primary, fontWeight: '600' }}>{t('manager.people.invite.sent')}</AppText>
              <View style={{ gap: 4 }}>
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {t('manager.people.invite.passwordLabel')}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AppText selectable style={{ fontWeight: '700', fontSize: 16, flex: 1 }}>
                    {created.password}
                  </AppText>
                  <Button label={t(copied ? 'manager.people.invite.copied' : 'manager.people.invite.copy')} variant="secondary" onPress={() => void copyPassword()} />
                </View>
                <AppText variant="caption" muted>
                  {t('manager.people.invite.passwordHelp')}
                </AppText>
              </View>
            </View>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {t('auth.signup.fullName')}
                </AppText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('auth.signup.fullName')}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t('auth.signup.fullName')}
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: 4 }}>
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {t('auth.signup.email')}
                </AppText>
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError(false);
                  }}
                  placeholder="nome@esempio.it"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t('auth.signup.email')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={[inputStyle, error && !emailLooksValid ? { borderColor: theme.danger } : null]}
                />
              </View>
              <View style={{ gap: 4 }}>
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {t('manager.people.invite.phoneLabel')}
                </AppText>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('manager.people.invite.phonePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t('manager.people.invite.phoneLabel')}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'phone-pad'}
                  style={inputStyle}
                />
                {sanitizePhone(phone).length >= 8 ? (
                  <AppText
                    accessibilityRole="link"
                    onPress={() => openExternalUrl(`https://wa.me/${sanitizePhone(phone)}`)}
                    style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                    {t('manager.people.invite.openChat')}
                  </AppText>
                ) : null}
              </View>
              {error ? <Banner title={t(emailLooksValid ? 'manager.people.invite.error' : 'manager.people.invite.emailInvalid')} /> : null}
              <Button label={t('manager.people.invite.send')} onPress={() => void submit()} disabled={busy || !canSubmit} />
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

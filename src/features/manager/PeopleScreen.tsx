import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EyeIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth/auth-context';
import { formatShortDate } from '@/lib/format';
import { isPlausibleName, isPlausiblePhone } from '@/lib/domain/input-checks';
import { useI18n } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { useAsync } from '@/lib/use-async';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { downloadXlsx } from '@/lib/xlsx';

import { ManagerNotifications } from './ManagerNotifications';
import { createMember, deletePerson, getPendingRequests, getRoster, setPersonStatus, type NewMember, type RosterEntry } from './manager-api';
import { PendingRequestsPanel } from './PendingRequestsPanel';
import { roleColor } from './role-colors';

export function PeopleScreen() {
  const { t, lang } = useI18n();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const roster = useAsync(() => (siteId ? getRoster(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  const requests = useAsync(() => (siteId ? getPendingRequests(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  function reloadAll(): void {
    roster.reload();
    requests.reload();
  }
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
    downloadXlsx(t('manager.people.title').toLowerCase(), t('manager.people.title'), header, rows);
  }

  return (
    <Screen onRefresh={reloadAll} refreshing={roster.loading && roster.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <ScreenHeader icon={UsersIcon} label={t('manager.people.title')} notifications={<ManagerNotifications />} />
        {roster.data && roster.data.length > 0 ? <Button label={t('manager.people.export')} variant="secondary" onPress={exportCsv} /> : null}
      </View>

      {roster.error ? <Banner title={t('manager.people.error')} /> : null}
      {roster.data === undefined && roster.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {deleteError ? <Banner title={t('manager.people.delete.error')} /> : null}

      {requests.data ? <PendingRequestsPanel requests={requests.data} onChanged={reloadAll} /> : null}

      {roster.data ? (
        <>
          <RosterPanel title={t('manager.people.coaches')} people={coaches} onOpenSheet={setSheetPerson} addRole="coach" onCreated={roster.reload} />
          <RosterPanel title={t('manager.people.clients')} people={clients} onOpenSheet={setSheetPerson} addRole="client" onCreated={roster.reload} />
        </>
      ) : null}

      <ActionSheet
        visible={sheetPerson !== null}
        title={sheetPerson?.fullName ?? t('common.unnamedPerson')}
        avatar={sheetPerson ? { userId: sheetPerson.userId, uri: sheetPerson.avatarUrl, name: sheetPerson.fullName } : undefined}
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

/** One roster row, filled edge-to-edge with the role's colour, laid out in the same columns as the
 * panel's header above it (name, phone, activated, deactivated) — and an eye button that opens the
 * actions sheet (activate/deactivate, delete), a Manager's one entry point to manage someone
 * without deleting their history by accident. */
function PersonRow({ person, last, onOpenSheet }: { person: RosterEntry; last: boolean; onOpenSheet: (person: RosterEntry) => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { bg: rowBg, on: onRowColor } = roleColor(person.role, theme);
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
      <Avatar uri={person.avatarUrl} name={person.fullName} size={32} tint="rgba(255,255,255,0.3)" onTint={onRowColor} />
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
 * `Linking.openURL` on web navigates the current tab away to wa.me, replacing the whole app. This
 * screen only ever renders on web (Manager is a web-only role), so `window.open` is always available
 * here — opens WhatsApp in a new tab/app instead, same as any ordinary link, and leaves Gymly's own
 * tab untouched. Native (Coach/Client apps) keeps `Linking`.
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
 * Manager never sees or picks the password — it's generated here), then opens WhatsApp straight to
 * the new member's own number with name/email/password/link all ready to send, one message, nothing
 * shown a second time elsewhere in Gymly — confirmed, final: the password belongs in that one
 * message, not duplicated into a separate "Copia" box here too. */
function AddMemberPanel({ role, onCreated }: { role: 'coach' | 'client'; onCreated: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [created, setCreated] = useState<NewMember | null>(null);

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
    setEmailTaken(false);
    try {
      const member: NewMember = await createMember(role, name, email, phone);
      const link = Linking.createURL('/');
      const message = t('manager.people.invite.message', { name: name.trim() || t('common.unnamedPerson'), email: member.email, password: member.password, link });
      openExternalUrl(`https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(message)}`);
      setCreated(member);
      onCreated();
    } catch (e) {
      // The generic banner used to swallow every cause the same way — including the single most
      // common one in practice (re-using an email that's already registered), which just needs a
      // clear "use a different email" instead of a dead-end "something went wrong". The raw detail
      // (duck-typed: Supabase's PostgrestError/AuthError don't reliably pass `instanceof Error`)
      // still goes to the dev-only logger for anything less common.
      const code = e && typeof e === 'object' && 'code' in e ? e.code : null;
      const message = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : '';
      logger.error('manager.create_member_failed', e);
      // `code` is Supabase Auth's own stable identifier for this case (live-verified:
      // `AuthApiError` with `code: 'user_already_exists'`, message "User already registered") — the
      // message regex is only a fallback for whatever doesn't carry that code.
      setEmailTaken(code === 'user_already_exists' || /already registered|already exists/i.test(message));
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function toggle(): void {
    setOpen(!open);
    setName('');
    setEmail('');
    setPhone('');
    setError(false);
    setEmailTaken(false);
    setCreated(null);
  }

  const nameBad = name.trim().length > 0 && !isPlausibleName(name);
  const phoneBad = phone.trim().length > 0 && !isPlausiblePhone(phone);
  const canSubmit = name.trim().length > 0 && !nameBad && email.trim().length > 0 && sanitizePhone(phone).length > 0 && !phoneBad;

  return (
    <View>
      <Button label={t(role === 'coach' ? 'manager.people.invite.coach' : 'manager.people.invite.client')} variant="secondary" onPress={toggle} />
      {open ? (
        <Card style={{ marginTop: spacing.sm }}>
          <AppText variant="caption" muted>
            {t('manager.people.invite.help')}
          </AppText>

          {created ? (
            <AppText style={{ color: theme.primary, fontWeight: '600' }}>{t('manager.people.invite.sent')}</AppText>
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
              {error ? (
                <Banner
                  title={t(
                    !emailLooksValid ? 'manager.people.invite.emailInvalid' : emailTaken ? 'manager.people.invite.emailTaken' : 'manager.people.invite.error'
                  )}
                />
              ) : null}
              {nameBad || phoneBad ? (
                <AppText color={theme.danger} style={{ fontSize: 13, fontWeight: '600' }}>
                  {t(nameBad ? 'auth.signup.error.invalidName' : 'auth.signup.error.invalidPhone')}
                </AppText>
              ) : null}
              <Button label={t('manager.people.invite.send')} onPress={() => void submit()} disabled={busy || !canSubmit} />
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { AddressMapPreview } from '@/components/AddressMapPreview';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CheckIcon, ChevronLeftIcon, MapPinIcon, MessageCircleIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ChatModal } from '@/features/chat/ChatModal';
import { getConversations, openConversation } from '@/features/chat/chat-api';
import { Pagination } from '@/components/TablePagination';
import { avatarTint } from '@/lib/avatar-tint';
import { isPlausibleName, isPlausiblePhone } from '@/lib/domain/input-checks';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { useSidebarMode } from '@/lib/use-sidebar-mode';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { addManager, getOwnerChainName, getOwnerManagerDetail, getOwnerManagers, type AddManagerResult, type OwnerClient, type OwnerManagerDetail, type OwnerManagerRow } from './owner-api';

const PAGE_SIZE = 8;

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/** Small colour-tinted icon badge — same visual convention as Admin/Owner Dashboard's section headers. */
function IconBadge({ icon: Icon, tint, size = 26 }: { icon: IconType; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={tint} size={Math.round(size * 0.54)} />
    </View>
  );
}

/** Same web-vs-native tab-hijack fix already used for every other WhatsApp link in this app
 * (`PeopleScreen.tsx`, `ManagerPositionCard.tsx`) — duplicated locally per that same convention. */
function openExternalUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(url);
}

function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}


function fieldStyle(theme: ReturnType<typeof useTheme>, danger = false) {
  return {
    minHeight: MIN_TAP,
    borderWidth: 1.5,
    borderColor: danger ? theme.danger : theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontSize: 15,
  } as const;
}

function Field({ label, ...inputProps }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <TextInput placeholderTextColor={theme.textMuted} style={fieldStyle(theme)} {...inputProps} />
    </View>
  );
}

/** "Aggiungi Manager" popup — same `<Modal transparent>` shell as `ManagerSignupScreen.tsx`'s
 * `PlanPickerModal`. Creates a real account via the `owner-create-manager` Edge Function (the one
 * place in the app that needs server-side privileges — see CLAUDE.md), then opens WhatsApp with the
 * credentials, same pattern as `PeopleScreen.tsx`'s Coach/Client invite flow. */
function AddManagerModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  // The gym's name is the Owner's, chosen once and the same for every Manager they add — shown here locked
  // (the database enforces it as well, see owner_create_manager_record()).
  const chain = useAsync(() => getOwnerChainName(), [], visible);
  const siteName = chain.data ?? '';
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddManagerResult | null>(null);

  // No manual lat/lng here on purpose — "solo via e città, la posizione si fa automaticamente sulla
  // mappa" per the user. `addManager` already treats coordinates as optional: without them the new
  // site's exact GPS pin is simply unset, same as a self-registered Manager's gym before they fill
  // in "Posizione palestra" themselves — nothing here depends on having it upfront.
  const fullAddress = [street.trim(), city.trim()].filter(Boolean).join(', ');
  const addressQuery = fullAddress || null;
  const nameBad = fullName.trim().length > 0 && !isPlausibleName(fullName);
  const phoneBad = whatsapp.trim().length > 0 && !isPlausiblePhone(whatsapp);
  const canSubmit = fullName.trim().length > 0 && !nameBad && !phoneBad && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && siteName.trim().length > 0 && fullAddress.length > 0;

  function reset(): void {
    setFullName('');
    setEmail('');
    setWhatsapp('');
    setStreet('');
    setCity('');
    setError(null);
    setResult(null);
  }

  function close(): void {
    reset();
    onClose();
  }

  async function submit(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addManager({
        fullName: fullName.trim(),
        email: email.trim(),
        siteName: siteName.trim(),
        address: fullAddress,
        whatsappPhone: whatsapp,
      });
      const link = Linking.createURL('/');
      const message = t('owner.managers.add.whatsappMessage', { name: fullName.trim(), email: created.email, password: created.tempPassword, link });
      if (sanitizePhone(whatsapp).length > 0) {
        openExternalUrl(`https://wa.me/${sanitizePhone(whatsapp)}?text=${encodeURIComponent(message)}`);
      }
      setResult(created);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('owner.managers.add.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="display" style={{ fontSize: 22 }}>
              {t('owner.managers.add.title')}
            </AppText>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>

          {result ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckIcon color={theme.band.green.solid} size={18} />
                <AppText style={{ color: theme.band.green.solid, fontWeight: '700' }}>{t('owner.managers.add.success')}</AppText>
              </View>
              <AppText muted style={{ fontSize: 13 }}>
                {t('owner.managers.add.successHelp')}
              </AppText>
              <Button label={t('common.close')} onPress={close} />
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Field label={t('auth.signup.fullName')} value={fullName} onChangeText={setFullName} />
              <Field label={t('auth.signup.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label={t('manager.people.invite.phoneLabel')} value={whatsapp} onChangeText={setWhatsapp} placeholder={t('manager.people.invite.phonePlaceholder')} />
              <View style={{ gap: 4 }}>
                <Field label={t('owner.managers.add.siteName')} value={siteName} editable={false} />
                <AppText muted style={{ fontSize: 12 }}>
                  {t('owner.managers.add.siteNameFixed')}
                </AppText>
              </View>

              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {t('owner.managers.add.addressTitle')}
                </AppText>
                <TextInput value={street} onChangeText={setStreet} placeholder={t('manager.gym.location.addressSearch.street')} placeholderTextColor={theme.textMuted} style={fieldStyle(theme)} />
                <TextInput value={city} onChangeText={setCity} placeholder={t('manager.gym.location.addressSearch.city')} placeholderTextColor={theme.textMuted} style={fieldStyle(theme)} />

                <AddressMapPreview addressQuery={addressQuery} lat="" lng="" />
                <AppText muted style={{ fontSize: 12 }}>
                  {t('owner.managers.add.coordsHelp')}
                </AppText>
              </View>

              {nameBad || phoneBad ? <Banner title={t(nameBad ? 'auth.signup.error.invalidName' : 'auth.signup.error.invalidPhone')} /> : null}
              {error ? <Banner title={error} /> : null}

              <Button label={t('owner.managers.add.submit')} onPress={() => void submit()} disabled={!canSubmit || busy} />
              {busy ? <ActivityIndicator /> : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const PAYMENT_LABEL = { paid: 'owner.managers.detail.paid', unpaid: 'owner.managers.detail.unpaid' } as const;
const MEMBERSHIP_LABEL = { annual: 'owner.managers.detail.annual', monthly: 'owner.managers.detail.monthly' } as const;

/** Small count badge for the detail modal's top summary row. */
function StatChip({ label, value, tint }: { label: string; value: number; tint: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, paddingVertical: 6, paddingHorizontal: 10 }}>
      <AppText style={{ fontWeight: '800', fontSize: 14, color: tint }}>{value}</AppText>
      <AppText variant="caption" muted style={{ fontSize: 11.5 }}>
        {label}
      </AppText>
    </View>
  );
}

/** Read-only by design — the Owner only ever VIEWS a Manager's clients, never edits their payment
 * status or anything else here (that stays the Manager's own job, in their own app). The Owner's
 * one and only interactive action anywhere in this whole area is messaging the Manager directly
 * (see the "Messaggio" button on the card and in this modal's header). */
function ClientRow({ client }: { client: OwnerClient }) {
  const { t } = useI18n();
  const theme = useTheme();
  const badgeColor = client.paymentStatus === 'paid' ? theme.band.green : client.paymentStatus === 'unpaid' ? theme.band.red : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        padding: spacing.sm,
      }}>
      <Avatar uri={null} name={client.fullName} size={30} tint={avatarTint(theme, client.fullName ?? '?')} />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700' }}>
          {client.fullName || t('common.unnamedPerson')}
        </AppText>
        {client.membershipType ? (
          <AppText variant="caption" muted style={{ fontSize: 11.5 }}>
            {t(MEMBERSHIP_LABEL[client.membershipType])}
          </AppText>
        ) : null}
      </View>
      {badgeColor ? (
        <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: badgeColor.soft }}>
          <AppText style={{ color: badgeColor.onSoft, fontSize: 11, fontWeight: '700' }}>{t(PAYMENT_LABEL[client.paymentStatus as 'paid' | 'unpaid'])}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Dettaglio Manager — clients/coaches/location/payment summary for one Manager's site, as an
 * in-screen popup, same convention as Admin's per-site sheet (no separate route). Strictly
 * read-only: viewing + messaging the Manager (in-app chat) are the only two things the Owner can do
 * here, by explicit product decision — no editing of anything shown. */
function ManagerDetailModal({ row, onClose, onMessage }: { row: OwnerManagerRow | null; onClose: () => void; onMessage: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const managerId = row?.managerId ?? null;
  const { width, height } = useWindowDimensions();
  const stacked = width < 760;
  // Wide layout: only the roster scrolls (capped to what fits under the pinned header/stats), so the
  // map never moves. Stacked layout: the whole body scrolls instead.
  const rosterMaxHeight = Math.max(220, height * 0.92 - 340);
  const detail = useAsync<OwnerManagerDetail | null>(() => (managerId ? getOwnerManagerDetail(managerId) : Promise.resolve(null)), [managerId], managerId !== null);
  const clients = detail.data?.clients ?? [];
  const coaches = detail.data?.coaches ?? [];
  // Computed here, not a separate RPC round-trip — `owner_get_manager_detail` already returns every
  // client's membershipType+paymentStatus, which is all these breakdowns need.
  const monthlyPaid = clients.filter((c) => c.membershipType === 'monthly' && c.paymentStatus === 'paid').length;
  const monthlyUnpaid = clients.filter((c) => c.membershipType === 'monthly' && c.paymentStatus === 'unpaid').length;
  const annualPaid = clients.filter((c) => c.membershipType === 'annual' && c.paymentStatus === 'paid').length;
  const annualUnpaid = clients.filter((c) => c.membershipType === 'annual' && c.paymentStatus === 'unpaid').length;

  return (
    <Modal visible={managerId !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 920, maxHeight: '92%', borderRadius: radius.card, backgroundColor: theme.background, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <AppText variant="display" style={{ fontSize: 20 }} numberOfLines={1}>
                {t('owner.managers.detail.title')}
              </AppText>
              <AppText muted numberOfLines={1} style={{ fontSize: 14 }}>
                {row?.fullName || t('common.unnamedPerson')}
              </AppText>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>

          <Pressable
            onPress={onMessage}
            accessibilityRole="button"
            accessibilityLabel={t('owner.managers.message')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: MIN_TAP,
              borderRadius: radius.pill,
              backgroundColor: theme.primary,
            }}>
            <MessageCircleIcon color={theme.onPrimary} size={16} />
            <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>{t('owner.managers.message')}</AppText>
          </Pressable>

          {detail.loading && !detail.data ? <ActivityIndicator /> : null}
          {detail.error ? <Banner title={t('owner.managers.detail.error')} /> : null}

          {detail.data ? (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <StatChip label={t('owner.managers.detail.statClients')} value={clients.length} tint={theme.primary} />
                <StatChip label={t('owner.managers.detail.statCoaches')} value={coaches.length} tint={theme.band.amber.solid} />
                <StatChip label={t('owner.managers.detail.statMonthlyPaid')} value={monthlyPaid} tint={theme.band.green.solid} />
                <StatChip label={t('owner.managers.detail.statMonthlyUnpaid')} value={monthlyUnpaid} tint={theme.band.red.solid} />
                <StatChip label={t('owner.managers.detail.statAnnualPaid')} value={annualPaid} tint={theme.band.green.solid} />
                <StatChip label={t('owner.managers.detail.statAnnualUnpaid')} value={annualUnpaid} tint={theme.band.red.solid} />
              </View>

              {/* Side by side on wide screens (roster scrolls, map stays put), stacked on narrow ones. */}
              <View style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
                <ScrollView
                  nestedScrollEnabled
                  style={stacked ? { width: '100%', flexGrow: 0 } : { flex: 1.15, maxHeight: rosterMaxHeight }}
                  contentContainerStyle={{ gap: spacing.lg }}
                  showsVerticalScrollIndicator={false}>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <IconBadge icon={UsersIcon} tint={theme.primary} size={22} />
                      <AppText style={{ fontWeight: '800', fontSize: 15 }}>{t('owner.managers.detail.clients')}</AppText>
                    </View>
                    {clients.length === 0 ? (
                      <AppText muted style={{ fontSize: 13 }}>
                        {t('owner.managers.detail.noClients')}
                      </AppText>
                    ) : (
                      <View style={{ gap: spacing.xs }}>
                        {clients.map((c) => (
                          <ClientRow key={c.id} client={c} />
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <IconBadge icon={UsersIcon} tint={theme.band.amber.solid} size={22} />
                      <AppText style={{ fontWeight: '800', fontSize: 15 }}>{t('owner.managers.detail.coaches')}</AppText>
                    </View>
                    {coaches.length === 0 ? (
                      <AppText muted style={{ fontSize: 13 }}>
                        {t('owner.managers.detail.noCoaches')}
                      </AppText>
                    ) : (
                      <View style={{ gap: spacing.xs }}>
                        {coaches.map((c) => (
                          <View
                            key={c.id}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, padding: spacing.sm }}>
                            <Avatar uri={null} name={c.fullName} size={30} tint={avatarTint(theme, c.fullName ?? '?')} />
                            <AppText style={{ fontSize: 13.5, fontWeight: '600' }}>{c.fullName || t('common.unnamedPerson')}</AppText>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View style={{ flex: stacked ? undefined : 0.85, width: stacked ? '100%' : undefined, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <IconBadge icon={MapPinIcon} tint={theme.primary} size={22} />
                    <AppText numberOfLines={2} style={{ flex: 1, fontWeight: '700', fontSize: 14 }}>
                      {detail.data.address || t('owner.managers.detail.noAddress')}
                    </AppText>
                  </View>
                  {/* Precise coordinates (set later by the Manager themselves, in their own
                      "Posizione palestra") aren't required to show a map — just like "Aggiungi
                      Manager"'s own preview, the typed address alone is enough via Google's own
                      `q=` text geocoding on the embed URL. */}
                  <AddressMapPreview
                    addressQuery={detail.data.address}
                    lat={detail.data.lat !== null ? String(detail.data.lat) : ''}
                    lng={detail.data.lng !== null ? String(detail.data.lng) : ''}
                    height={260}
                  />
                  {detail.data.lat !== null && detail.data.lng !== null ? (
                    <View style={{ alignSelf: 'flex-end', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
                      <AppText variant="caption" style={{ fontSize: 11, fontWeight: '700' }}>{t('owner.managers.detail.radius', { n: detail.data.radius })}</AppText>
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Vertical card (not a table row) — avatar initials, address, client count, a dedicated "Messaggio"
 * action that opens the in-app conversation with that Manager. Tapping the card
 * body elsewhere opens the full detail sheet (clients/coaches/map/payments). */
function ManagerCard({ row, unread, onOpenDetail, onMessage }: { row: OwnerManagerRow; unread: number; onOpenDetail: () => void; onMessage: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.card,
        padding: spacing.md,
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
      }}>
      {/* A `<button>` can't contain another `<button>` on web (react-native-web renders
          `accessibilityRole="button"` Pressables as real `<button>` elements) — the "open detail"
          tap area and the "Messaggio" button are siblings here, not nested, to avoid that DOM
          violation (it threw a real dev error, not just a style nit). */}
      <Pressable onPress={onOpenDetail} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.85 : 1 })}>
        <Avatar uri={null} name={row.fullName} size={44} tint={avatarTint(theme, row.fullName ?? row.email)} />
        <View style={{ flex: 1, gap: 3 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 16 }}>
            {row.fullName || t('common.unnamedPerson')}
          </AppText>
          {row.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPinIcon color={theme.textMuted} size={13} />
              <AppText numberOfLines={1} muted style={{ fontSize: 12.5, flexShrink: 1 }}>
                {row.address}
              </AppText>
            </View>
          ) : null}
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 2,
              paddingHorizontal: 8,
              borderRadius: radius.pill,
              backgroundColor: theme.surfaceAlt,
              marginTop: 2,
            }}>
            <UsersIcon color={theme.textMuted} size={12} />
            <AppText variant="caption" style={{ fontSize: 11.5, fontWeight: '600' }}>
              {t('owner.managers.clientsCount', { count: row.clientCount })}
            </AppText>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onMessage}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `${t('owner.managers.message')}, ${t('owner.managers.unread', { n: unread })}` : t('owner.managers.message')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: MIN_TAP - 4,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: theme.primary,
        }}>
        <MessageCircleIcon color={theme.onPrimary} size={15} />
        <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 13 }}>{t('owner.managers.message')}</AppText>
        {unread > 0 ? (
          // A number, not just a coloured dot — never colour alone.
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.onPrimary }}>
            <AppText style={{ color: theme.primary, fontWeight: '700', fontSize: 11.5 }}>{unread}</AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function OwnerManagersScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const managers = useAsync(() => getOwnerManagers(), []);
  const conversations = useAsync(() => getConversations(), []);
  // Unread messages per Manager (keyed by the Manager's profile id), so a reply never goes unnoticed.
  const unreadByManager = new Map((conversations.data ?? []).map((c) => [c.otherId, c.unreadCount]));
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<OwnerManagerRow | null>(null);
  const [chat, setChat] = useState<{ id: string; title: string } | null>(null);
  const [chatError, setChatError] = useState(false);
  usePageHeader(UsersIcon, t('owner.managers.title'));
  const isSidebar = useSidebarMode();

  // Opens (creating it the first time) the conversation with this Manager — works for every Manager,
  // with or without a saved phone number, which the old WhatsApp-only button needed.
  async function openChat(row: OwnerManagerRow): Promise<void> {
    setChatError(false);
    try {
      const id = await openConversation(row.managerId);
      setDetailRow(null);
      setChat({ id, title: row.fullName || t('common.unnamedPerson') });
    } catch {
      setChatError(true);
    }
  }

  const rows = managers.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <Screen
      onRefresh={() => {
        managers.reload();
        conversations.reload();
      }}
      refreshing={managers.loading && managers.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: 2, flex: 1 }}>
          {/* Sidebar mode already shows this title in the fixed top bar (`usePageHeader` above). */}
          {!isSidebar ? <AppText style={{ fontFamily: fontFamily.displaySemi, fontSize: 26 }}>{t('owner.managers.title')}</AppText> : null}
          <AppText muted style={{ fontSize: 13 }}>
            {t('owner.managers.subtitle', { count: rows.length })}
          </AppText>
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.primary }}>
          <PlusIcon color={theme.onPrimary} size={16} strokeWidth={2.4} />
          <AppText style={{ color: theme.onPrimary, fontWeight: '700', fontSize: 14 }}>{t('owner.managers.add.button')}</AppText>
        </Pressable>
      </View>

      {managers.error ? <Banner title={t('owner.managers.error')} /> : null}
      {chatError ? <Banner title={t('owner.managers.message.error')} /> : null}
      {managers.data === undefined && managers.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {managers.data && rows.length === 0 ? <Banner message={t('owner.managers.empty')} /> : null}

      {pageRows.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {pageRows.map((row) => (
            <ManagerCard key={row.managerId} row={row} unread={unreadByManager.get(row.managerId) ?? 0} onOpenDetail={() => setDetailRow(row)} onMessage={() => void openChat(row)} />
          ))}
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AppText variant="caption" muted>
            {t('owner.managers.showing', { from: pageStart + 1, to: Math.min(pageStart + PAGE_SIZE, rows.length), total: rows.length })}
          </AppText>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} nextLabel={t('owner.managers.nextPage')} />
        </View>
      ) : null}

      <AddManagerModal visible={addOpen} onClose={() => setAddOpen(false)} onCreated={() => managers.reload()} />
      <ManagerDetailModal row={detailRow} onClose={() => setDetailRow(null)} onMessage={() => detailRow && void openChat(detailRow)} />
      <ChatModal key={chat?.id ?? 'none'} conversationId={chat?.id ?? null} title={chat?.title ?? ''} onClose={() => setChat(null)} onChanged={conversations.reload} />
    </Screen>
  );
}

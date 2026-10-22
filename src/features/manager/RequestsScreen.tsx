import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { DateBadge } from '@/components/DateBadge';
import { DownloadIcon, InboxIcon, SearchIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth/auth-context';
import { formatRelativeTime, formatShortDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/lib/theme';

import { ManagerNotifications } from './ManagerNotifications';
import { approveRequest, getPendingRequests, getRoster, getRosterEmails, rejectRequest, type PendingRequest } from './manager-api';

export function RequestsScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { dateKey } = useSelectedDate();
  const requests = useAsync(() => (siteId ? getPendingRequests(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  const roster = useAsync(() => (siteId ? getRoster(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  const emails = useAsync(() => (siteId ? getRosterEmails(siteId) : Promise.resolve(new Map<string, string>())), [siteId], siteId !== null);
  const approvedClients = (roster.data ?? []).filter((r) => r.role === 'client' && r.status === 'active');

  function refreshAll(): void {
    requests.reload();
    roster.reload();
    emails.reload();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stamps a "last refreshed" clock off a prop flip (new data arriving), not a value derivable from render
    if (requests.data) setLastUpdated(new Date());
  }, [requests.data]);

  async function act(request: PendingRequest, action: 'approve' | 'reject'): Promise<void> {
    setBusyId(request.userId);
    setErrorId(null);
    try {
      await (action === 'approve' ? approveRequest(request.userId) : rejectRequest(request.userId));
      requests.reload();
      roster.reload();
    } catch {
      setErrorId(request.userId);
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv(): void {
    const header = [
      t('manager.requests.col.name'),
      t('manager.requests.col.status'),
      t('manager.requests.col.email'),
      t('manager.requests.col.phone'),
      t('manager.requests.col.date'),
    ];
    const pendingRows = (requests.data ?? []).filter((r) => isOnDateKey(r.createdAt, dateKey)).map((r) => [
      r.fullName ?? t('common.unnamedPerson'),
      t('manager.requests.statusPending'),
      emails.data?.get(r.userId) ?? '',
      '',
      new Date(r.createdAt).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB'),
    ]);
    const approvedRows = approvedClients.map((c) => [
      c.fullName ?? t('common.unnamedPerson'),
      t('manager.requests.statusApproved'),
      emails.data?.get(c.userId) ?? '',
      c.phone ?? '',
      c.activatedAt ? new Date(c.activatedAt).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB') : '',
    ]);
    const escape = (cell: string): string => `"${cell.replace(/"/g, '""')}"`;
    const csv = '﻿' + [header, ...pendingRows, ...approvedRows].map((row) => row.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('manager.requests.title').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Scoped to the day picked from the top-bar date badge (defaults to today) — "chi si è iscritto
  // [quel giorno]", by signup date.
  const all = (requests.data ?? []).filter((r) => isOnDateKey(r.createdAt, dateKey));
  const searchLower = search.trim().toLowerCase();
  // Newest first — was a toggle, removed along with the "Filtra" button that drove it.
  const filtered = all
    .filter((r) => !searchLower || (r.fullName ?? '').toLowerCase().includes(searchLower))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filteredApproved = approvedClients
    .filter((c) => !searchLower || (c.fullName ?? '').toLowerCase().includes(searchLower) || (c.phone ?? '').toLowerCase().includes(searchLower))
    .sort((a, b) => new Date(b.activatedAt ?? 0).getTime() - new Date(a.activatedAt ?? 0).getTime());
  const canExport = all.length > 0 || approvedClients.length > 0;

  return (
    <Screen onRefresh={refreshAll} refreshing={requests.loading && requests.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <ScreenHeader icon={InboxIcon} label={t('manager.requests.titleWithCount', { n: all.length })} notifications={<ManagerNotifications />} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 50,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}>
            <SearchIcon color={theme.textMuted} size={16} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('manager.requests.search.placeholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('manager.requests.search.placeholder')}
              autoComplete="off"
              textContentType="none"
              style={{ color: theme.text, fontSize: 14, minWidth: 160 }}
            />
          </View>
          <DateBadge />
          <Pressable
            onPress={exportCsv}
            disabled={!canExport}
            accessibilityRole="button"
            accessibilityLabel={t('manager.requests.export')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 50,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: theme.text,
              opacity: canExport ? 1 : 0.4,
            }}>
            <DownloadIcon color={theme.background} size={16} />
            <AppText color={theme.background} style={{ fontWeight: '700' }}>
              {t('manager.requests.export')}
            </AppText>
          </Pressable>
        </View>
      </View>

      {requests.error ? <Banner title={t('manager.requests.loadError')} /> : null}
      {requests.data === undefined && requests.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}

      {requests.data && all.length > 0 && filtered.length === 0 ? (
        <AppText variant="caption" muted style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
          {t('manager.requests.noResults')}
        </AppText>
      ) : null}

      {filtered.map((r) => (
        <Card key={r.userId} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Avatar uri={null} name={r.fullName} size={44} tint={theme.accent} onTint={theme.onAccent} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText numberOfLines={1} style={{ fontWeight: '700' }}>
                {r.fullName ?? t('common.unnamedPerson')}
              </AppText>
              <AppText variant="caption" muted>
                {t('manager.requests.requestedAgo', { time: formatRelativeTime(lang, r.createdAt) })}
              </AppText>
            </View>
          </View>
          {errorId === r.userId ? (
            <AppText color={theme.danger} style={{ fontWeight: '600', fontSize: 12.5 }}>
              {t('manager.requests.error')}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label={t('manager.requests.reject')} variant="dangerSoft" onPress={() => void act(r, 'reject')} disabled={busyId === r.userId} style={{ flex: 1 }} />
            <Button label={t('manager.requests.approve')} onPress={() => void act(r, 'approve')} disabled={busyId === r.userId} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      {requests.data && all.length > 0 ? (
        <AppText variant="caption" muted style={{ textAlign: 'center', paddingVertical: spacing.sm }}>
          {t('manager.requests.footer', {
            shown: filtered.length,
            total: all.length,
            time: lastUpdated ? lastUpdated.toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
          })}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <SectionTitle>{t('manager.requests.approvedTitle', { n: approvedClients.length })}</SectionTitle>

        {roster.data === undefined && roster.loading ? <ActivityIndicator style={{ marginTop: spacing.md }} /> : null}

        {roster.data && approvedClients.length === 0 ? (
          <AppText variant="caption" muted>
            {t('manager.requests.approvedEmpty')}
          </AppText>
        ) : null}

        {roster.data && approvedClients.length > 0 && filteredApproved.length === 0 ? (
          <AppText variant="caption" muted>
            {t('manager.requests.noResults')}
          </AppText>
        ) : null}

        {filteredApproved.length > 0 ? (
          <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
            {filteredApproved.map((c, i) => (
              <View
                key={c.userId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: i % 2 === 1 ? theme.surfaceAlt : theme.surface,
                  borderBottomWidth: i === filteredApproved.length - 1 ? 0 : 1,
                  borderBottomColor: theme.border,
                }}>
                <Avatar uri={c.avatarUrl} name={c.fullName} size={36} tint={theme.accent} onTint={theme.onAccent} />
                <AppText numberOfLines={1} style={{ flex: 1.2, fontWeight: '600' }}>
                  {c.fullName ?? t('common.unnamedPerson')}
                </AppText>
                <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1.4 }}>
                  {emails.data?.get(c.userId) ?? '—'}
                </AppText>
                <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
                  {c.phone ?? '—'}
                </AppText>
                <AppText variant="caption" muted>
                  {c.activatedAt ? t('manager.people.activeSinceShort', { date: formatShortDate(lang, c.activatedAt) }) : '—'}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

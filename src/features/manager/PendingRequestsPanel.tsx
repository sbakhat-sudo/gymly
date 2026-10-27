import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InboxIcon } from '@/components/icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { formatRelativeTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import { approveRequest, rejectRequest, type PendingRequest } from './manager-api';

/**
 * Clients waiting for the Manager's approval, at the top of "Persone" (there is no separate "Richieste" area any more):
 * one card per request with who it is, where they asked to join from and how long ago, and "Approva" / "Rifiuta". Shows
 * nothing at all when there is no request. Approving moves the person into the clients list below.
 */
export function PendingRequestsPanel({ requests, onChanged }: { requests: PendingRequest[]; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function act(request: PendingRequest, action: 'approve' | 'reject'): Promise<void> {
    setBusyId(request.userId);
    setErrorId(null);
    try {
      await (action === 'approve' ? approveRequest(request.userId) : rejectRequest(request.userId));
      onChanged();
    } catch {
      setErrorId(request.userId);
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1.5, borderColor: theme.primary, backgroundColor: theme.surface, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: theme.surfaceAlt }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <InboxIcon color={theme.primary} size={18} />
          <AppText style={{ fontWeight: '800' }}>{t('manager.people.requests.title')}</AppText>
        </View>
        <View style={{ minWidth: 26, height: 26, paddingHorizontal: 8, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary }}>
          <AppText color={theme.onPrimary} style={{ fontWeight: '800', fontSize: 13 }}>
            {requests.length}
          </AppText>
        </View>
      </View>

      {sorted.map((r, i) => (
        <View key={r.userId} style={{ gap: spacing.sm, padding: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ProfileAvatar userId={r.userId} name={r.fullName} size={44} tint={theme.accent} onTint={theme.onAccent} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText numberOfLines={1} style={{ fontWeight: '700' }}>
                {r.fullName ?? t('common.unnamedPerson')}
              </AppText>
              {r.homeAddress ? (
                <AppText variant="caption" numberOfLines={2}>
                  {r.homeAddress}
                </AppText>
              ) : null}
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
        </View>
      ))}
    </View>
  );
}

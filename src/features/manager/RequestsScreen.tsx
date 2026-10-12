import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InboxIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { formatShortDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { approveRequest, getPendingRequests, rejectRequest, type PendingRequest } from './manager-api';

export function RequestsScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const requests = useAsync(() => (siteId ? getPendingRequests(siteId) : Promise.resolve([])), [siteId], siteId !== null);

  async function act(request: PendingRequest, action: 'approve' | 'reject'): Promise<void> {
    setBusyId(request.userId);
    setErrorId(null);
    try {
      await (action === 'approve' ? approveRequest(request.userId) : rejectRequest(request.userId));
      requests.reload();
    } catch {
      setErrorId(request.userId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen onRefresh={requests.reload} refreshing={requests.loading && requests.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('manager.requests.title')}
        </AppText>
      </View>

      {requests.error ? <Banner title={t('manager.requests.loadError')} /> : null}
      {requests.data === undefined && requests.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {requests.data && requests.data.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.glassTint,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.xs,
            }}>
            <InboxIcon color={theme.textMuted} size={26} />
          </View>
          <AppText style={{ fontWeight: '700', textAlign: 'center' }}>{t('manager.requests.empty')}</AppText>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            {t('manager.requests.empty.sub')}
          </AppText>
        </Card>
      ) : null}

      {requests.data && requests.data.length > 0 ? (
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: theme.surfaceAlt,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}>
            <AppText variant="caption" muted style={{ flex: 2, fontWeight: '700', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4 }}>
              {t('manager.requests.col.name')}
            </AppText>
            <AppText variant="caption" muted style={{ flex: 1, fontWeight: '700', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4 }}>
              {t('manager.requests.col.role')}
            </AppText>
            <AppText variant="caption" muted style={{ flex: 1, fontWeight: '700', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4 }}>
              {t('manager.requests.col.date')}
            </AppText>
            <View style={{ width: 230 }} />
          </View>

          {requests.data.map((r, i) => (
            <View
              key={r.userId}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                backgroundColor: i % 2 === 1 ? theme.surfaceAlt : theme.surface,
                borderBottomWidth: i === requests.data!.length - 1 ? 0 : 1,
                borderBottomColor: theme.border,
                gap: spacing.xs,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText numberOfLines={1} style={{ flex: 2, fontWeight: '600' }}>
                  {r.fullName ?? t('common.unnamedPerson')}
                </AppText>
                <AppText style={{ flex: 1 }} muted>
                  {t(r.role === 'coach' ? 'manager.requests.role.coach' : 'manager.requests.role.client')}
                </AppText>
                <AppText style={{ flex: 1 }} muted>
                  {formatShortDate(lang, r.createdAt)}
                </AppText>
                <View style={{ width: 230, flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
                  <Button
                    label={t('manager.requests.approve')}
                    onPress={() => void act(r, 'approve')}
                    disabled={busyId === r.userId}
                    style={{ minHeight: MIN_TAP, paddingHorizontal: spacing.md }}
                  />
                  <Button
                    label={t('manager.requests.reject')}
                    variant="dangerSoft"
                    onPress={() => void act(r, 'reject')}
                    disabled={busyId === r.userId}
                    style={{ minHeight: MIN_TAP, paddingHorizontal: spacing.md }}
                  />
                </View>
              </View>
              {errorId === r.userId ? (
                <AppText color={theme.danger} style={{ fontWeight: '600', fontSize: 12.5 }}>
                  {t('manager.requests.error')}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

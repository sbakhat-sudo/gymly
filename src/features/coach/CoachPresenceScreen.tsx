import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Screen } from '@/components/Screen';
import { CheckInButton } from '@/features/checkin/CheckInButton';
import { useAuth } from '@/lib/auth/auth-context';
import { getOpenCheckin, realCheckIn, realCheckOut, type OpenCheckin } from '@/lib/checkins-api';
import { elapsedSecondsSince, formatStopwatch } from '@/lib/domain/checkin';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/**
 * Coach's own work-presence: check in/out for the shift, never tied to (or affecting) the gym's
 * occupancy band — a real `checkins` row with `kind: 'coach'`, distinct from a client's row, so the
 * simulated band never counts it. This is what feeds the Manager's "chi c'è ora" list.
 */
export function CoachPresenceScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const appActive = useAppActive();
  const now = useNow(1000, appActive);

  const [record, setRecord] = useState<OpenCheckin | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  useEffect(() => {
    if (!userId || !siteId) return;
    let alive = true;
    getOpenCheckin(userId, siteId, 'coach').then(
      (r) => alive && setRecord(r),
      () => alive && setError(true)
    );
    return () => {
      alive = false;
    };
  }, [userId, siteId]);

  async function toggle(): Promise<void> {
    if (!userId || !siteId) return;
    setBusy(true);
    setError(false);
    try {
      if (record) {
        await realCheckOut(record.id);
        setRecord(null);
      } else {
        const next = await realCheckIn(userId, siteId, 'coach');
        setRecord(next);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = record !== null && record !== undefined;
  const elapsedLabel = record ? formatStopwatch(elapsedSecondsSince({ siteId: siteId ?? '', checkinAt: record.checkinAt, lastConfirmedAt: record.checkinAt }, now)) : null;

  return (
    <Screen orb={{ color: checkedIn ? theme.band.red.solid : theme.accent, top: 82, size: 360 }}>
      <View style={{ gap: 6 }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('coach.presence.title')}
        </AppText>
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('coach.presence.subtitle')}
        </AppText>
      </View>

      {error ? <Banner message={t('checkin.error.generic')} /> : null}

      <CheckInButton
        checkedIn={checkedIn}
        busy={busy || record === undefined}
        elapsedLabel={elapsedLabel}
        label={checkedIn ? t('checkin.button.out') : t('checkin.button.in')}
        accessibilityLabel={t(checkedIn ? 'coach.presence.out.a11y' : 'coach.presence.in.a11y')}
        onPress={() => void toggle()}
      />

      <View style={{ minHeight: 20, marginTop: -8, alignItems: 'center' }}>
        {checkedIn && elapsedLabel ? (
          <AppText muted accessibilityLabel={t('checkin.since.a11y', { time: elapsedLabel })} style={{ fontSize: 14 }}>
            {t('checkin.since')}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

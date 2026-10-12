import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { formatStopwatch } from '@/lib/domain/checkin';
import { getSiteStatus } from '@/lib/gym-status';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

import { CheckInButton } from './CheckInButton';
import { useCheckinContext } from './checkin-context';

/**
 * A real (approved) Client's check-in tab: same shared `CheckinContext` the floating tab bar's
 * central button reads (see `checkin-context.tsx` — it picks `useRealCheckin` for this role), so
 * both always agree. The phase machine (active → "sei ancora qui?" → auto check-out) is identical
 * to the guest/mock flow; only the persistence differs (the real `checkins` table).
 */
export function RealClientCheckInScreen({ siteId }: { siteId: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const checkin = useCheckinContext();
  const [siteName, setSiteName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSiteStatus(siteId).then((s) => alive && setSiteName(s.name));
    return () => {
      alive = false;
    };
  }, [siteId]);

  const checkedIn = checkin.phase !== null;
  const elapsedLabel = checkedIn ? formatStopwatch(checkin.elapsedSeconds) : null;
  const noticeText =
    checkin.notice === 'offline'
      ? t('checkin.error.offline')
      : checkin.notice === 'autoCheckedOut'
        ? t('checkin.autoCheckedOut')
        : checkin.notice === 'locationTimeout'
          ? t('checkin.error.locationTimeout')
          : checkin.notice === 'generic'
            ? t('checkin.error.generic')
            : checkin.notice && typeof checkin.notice === 'object'
            ? checkin.notice.server
            : null;

  return (
    <Screen orb={{ color: checkedIn ? theme.band.red.solid : theme.accent, top: 82, size: 360 }}>
      <View style={{ gap: 6 }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('checkin.title')}
        </AppText>
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('checkin.subtitle')}
        </AppText>
      </View>

      {siteName ? <AppText style={{ fontWeight: '600' }}>{siteName}</AppText> : null}

      {noticeText ? <Banner message={noticeText} /> : null}

      <CheckInButton
        checkedIn={checkedIn}
        busy={checkin.busy || checkin.loading}
        elapsedLabel={elapsedLabel}
        label={checkedIn ? t('checkin.button.out') : t('checkin.button.in')}
        accessibilityLabel={
          checkedIn ? t('checkin.button.out.a11y', { name: siteName ?? '' }) : t('checkin.button.in.a11y', { name: siteName ?? '' })
        }
        onPress={() => void (checkedIn ? checkin.checkOut() : checkin.checkIn())}
      />

      <View style={{ minHeight: 20, marginTop: -8, alignItems: 'center' }}>
        {checkedIn && elapsedLabel ? (
          <AppText muted accessibilityLabel={t('checkin.since.a11y', { time: elapsedLabel })} style={{ fontSize: 14 }}>
            {t('checkin.since')}
          </AppText>
        ) : null}
      </View>

      <ConfirmDialog
        visible={checkin.phase === 'awaitingConfirmation'}
        title={t('checkin.stillHere.title')}
        message={t('checkin.stillHere.body')}
        confirmLabel={t('checkin.stillHere.yes')}
        cancelLabel={t('checkin.stillHere.no')}
        onConfirm={() => void checkin.confirmStillHere()}
        onCancel={() => void checkin.checkOut()}
      />
    </Screen>
  );
}

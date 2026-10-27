import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogInIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { formatStopwatch } from '@/lib/domain/checkin';
import { isGymOpenNow, usePolledSiteStatus } from '@/lib/gym-status';
import { useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

import { CheckInButton } from './CheckInButton';
import { CheckinNoticeCard, type CheckinNoticeTone } from './CheckinNoticeCard';
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
  const { site } = usePolledSiteStatus(siteId);
  const now = useNow(30_000, true);
  const siteName = site?.name ?? null;

  const checkedIn = checkin.phase !== null;
  // Nobody checks in while the gym is closed (the database refuses it too); checking out stays possible.
  const closedBlock = !checkedIn && site !== null && !isGymOpenNow(site, now);
  const elapsedLabel = checkedIn ? formatStopwatch(checkin.elapsedSeconds) : null;
  // What to tell the member: a short title and one line. The server's own sentence (too far, not approved, expired
  // subscription…) becomes the detail; "troppo lontano" gets its own friendlier wording.
  let notice: { tone: CheckinNoticeTone; title: string; detail: string | null } | null = null;
  if (checkin.notice === 'offline') notice = { tone: 'info', title: t('checkin.notice.offline.title'), detail: t('checkin.error.offline') };
  else if (checkin.notice === 'autoCheckedOut') notice = { tone: 'info', title: t('checkin.notice.autoOut.title'), detail: t('checkin.autoCheckedOut.real') };
  else if (checkin.notice === 'locationTimeout') notice = { tone: 'tooFar', title: t('checkin.notice.location.title'), detail: t('checkin.error.locationTimeout') };
  else if (checkin.notice === 'generic') notice = { tone: 'info', title: t('checkin.notice.generic.title'), detail: t('checkin.error.generic') };
  else if (checkin.notice && typeof checkin.notice === 'object') {
    const tooFar = checkin.notice.server.toLowerCase().includes('troppo lontano');
    notice = tooFar
      ? { tone: 'tooFar', title: t('checkin.notice.tooFar.title'), detail: t('checkin.notice.tooFar.detail') }
      : { tone: 'info', title: t('checkin.notice.unavailable.title'), detail: checkin.notice.server };
  }

  return (
    <Screen orb={{ color: checkedIn ? theme.band.red.solid : theme.accent, top: 82, size: 360 }}>
      <View style={{ gap: 6 }}>
        <PageTitle icon={LogInIcon} label={t('checkin.title')} circleSize={22} fontSize={26} />
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('checkin.subtitle')}
        </AppText>
      </View>

      {siteName ? <AppText style={{ fontWeight: '600' }}>{siteName}</AppText> : null}

      {closedBlock ? <CheckinNoticeCard tone="closed" title={t('checkin.notice.closed.title')} detail={t('checkin.notice.closed.detail')} /> : null}
      {notice ? <CheckinNoticeCard tone={notice.tone} title={notice.title} detail={notice.detail} /> : null}

      <CheckInButton
        checkedIn={checkedIn}
        busy={checkin.busy || checkin.loading || closedBlock}
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
        message={t('checkin.stillHere.body.real')}
        confirmLabel={t('checkin.stillHere.yes')}
        cancelLabel={t('checkin.stillHere.no')}
        onConfirm={() => void checkin.confirmStillHere()}
        onCancel={() => void checkin.checkOut()}
      />
    </Screen>
  );
}

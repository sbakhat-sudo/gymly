import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { Banner } from '@/components/Banner';
import { Card, SectionLabel } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogInIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { GymGate } from '@/features/common/GymGate';
import { useLiveBand } from '@/features/home/use-live-band';
import { formatStopwatch } from '@/lib/domain/checkin';
import { useI18n } from '@/lib/i18n';
import { useCurrentSite } from '@/lib/sites-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import type { SiteSummary } from '@/schemas';

import { CheckInButton } from './CheckInButton';
import { useCheckinContext } from './checkin-context';

/** Check-in tab: the gym picker until a gym is chosen (shared with Live), then this gym's check-in. */
export function CheckInScreen() {
  const current = useCurrentSite();
  if (current.site) return <CheckInContent site={current.site} />;
  return (
    <Screen>
      <GymGate>{() => null}</GymGate>
    </Screen>
  );
}

function CheckInContent({ site }: { site: SiteSummary }) {
  const { t, band: bandLabel } = useI18n();
  const theme = useTheme();
  const checkin = useCheckinContext();
  const band = useLiveBand(site);

  const checkedIn = checkin.phase !== null;
  const elapsedLabel = checkedIn ? formatStopwatch(checkin.elapsedSeconds) : null;

  const noticeText =
    checkin.notice === 'offline'
      ? t('checkin.error.offline')
      : checkin.notice === 'autoCheckedOut'
        ? t('checkin.autoCheckedOut')
        : checkin.notice === 'generic'
          ? t('checkin.error.generic')
          : null;

  return (
    <Screen orb={{ color: checkedIn ? theme.band.red.solid : theme.accent, top: 82, size: 360 }}>
      <View style={{ gap: 6 }}>
        <PageTitle icon={LogInIcon} label={t('checkin.title')} circleSize={28} fontSize={36} />
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('checkin.subtitle')}
        </AppText>
      </View>

      {/* Where the check-in goes, with the live band when known (shape + label, never colour alone). */}
      <View
        accessible
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: 7,
          paddingLeft: 10,
          paddingRight: 12,
          borderRadius: radius.pill,
          backgroundColor: band ? theme.band[band].soft : theme.surfaceAlt,
        }}>
        {band ? <BandIcon band={band} size={12} color={theme.band[band].solid} /> : null}
        <AppText color={band ? theme.band[band].onSoft : theme.text} style={{ fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
          {band ? `${site.name} · ${bandLabel(band)}` : site.name}
        </AppText>
      </View>

      {noticeText ? <Banner message={noticeText} /> : null}

      <CheckInButton
        checkedIn={checkedIn}
        busy={checkin.busy || checkin.loading}
        elapsedLabel={elapsedLabel}
        label={checkedIn ? t('checkin.button.out') : t('checkin.button.in')}
        accessibilityLabel={
          checkedIn ? t('checkin.button.out.a11y', { name: site.name }) : t('checkin.button.in.a11y', { name: site.name })
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

      <Card>
        <SectionLabel>{t('checkin.notify.title')}</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP }}>
          <AppText style={{ flex: 1, fontWeight: '500' }}>{t('checkin.notify.toggle')}</AppText>
          <Toggle
            value={checkin.notifOptIn}
            onValueChange={(next) => void checkin.toggleNotify(next)}
            accessibilityLabel={t('checkin.notify.toggle')}
          />
        </View>
        {checkin.notifNotice ? (
          <Banner message={t(checkin.notifNotice === 'denied' ? 'checkin.notify.denied' : 'checkin.notify.unsupported')} />
        ) : null}
        <AppText muted style={{ fontSize: 12, lineHeight: 18 }}>
          {t('checkin.notify.help')}
        </AppText>
      </Card>

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

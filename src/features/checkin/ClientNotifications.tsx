import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { NotificationBell } from '@/components/NotificationBell';
import { useI18n } from '@/lib/i18n';

import { useCheckinContext } from './checkin-context';

/**
 * A real Client's notification bell: unlike `ManagerNotifications` (which polls server broadcasts),
 * everything here is purely local, time-derived state already owned by `CheckinContext` — the same
 * "sei ancora qui?" prompt the Check-in tab shows automatically once `phase === 'awaitingConfirmation'`
 * (90 minutes after check-in, repeating every 10 minutes — see `use-real-checkin.ts`). This bell just
 * gives it a second, always-visible entry point on the Live tab, so it "pops up" the moment the member
 * opens the app, not only once they happen to land on Check-in. Tapping the item jumps straight there,
 * where the full confirm/deny dialog already renders itself.
 */
export function ClientNotifications() {
  const { t } = useI18n();
  const router = useRouter();
  const checkin = useCheckinContext();
  const [open, setOpen] = useState(false);

  const stillHerePending = checkin.phase === 'awaitingConfirmation';
  const count = stillHerePending ? 1 : 0;

  return (
    <>
      <NotificationBell count={count} showCount onPress={() => setOpen(true)} accessibilityLabel={t('client.notifications.title', { n: count })} />

      <ActionSheet
        visible={open}
        title={t('client.notifications.title', { n: count })}
        subtitle={stillHerePending ? t('client.notifications.stillHere.sublabel') : undefined}
        actions={
          stillHerePending
            ? [
                {
                  label: t('client.notifications.stillHere.label'),
                  onPress: () => {
                    setOpen(false);
                    router.push('/(client)/checkin');
                  },
                },
              ]
            : []
        }
        onClose={() => setOpen(false)}>
        {stillHerePending ? null : (
          <AppText variant="caption" muted>
            {t('client.notifications.empty')}
          </AppText>
        )}
      </ActionSheet>
    </>
  );
}

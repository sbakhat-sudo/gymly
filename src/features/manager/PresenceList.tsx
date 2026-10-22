import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { SectionLabel } from '@/components/Card';
import { LiveDot } from '@/components/LiveDot';
import { TimerRing } from '@/components/TimerRing';
import { elapsedSecondsSince, formatClockMinutes } from '@/lib/domain/checkin';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import type { PresentPerson } from './manager-api';

/** Fixed, not `maxHeight`: a row's `Avatar` resolving its image after mount nudges the row's own
 * height, and a `maxHeight` ScrollView re-measures against that shifting content — same
 * async-image-resize timing bug already hit once on the Feedback screen's `CoachCard` (see its own
 * note). A fixed height sidesteps it entirely, and keeps this card the same height as "Attività in
 * corso" beside it either way. */
const PRESENCE_LIST_HEIGHT = 460;

/**
 * Page 1's "chi c'è ora" list: everyone with an open check-in at the gym right now, clients and
 * coaches together, newest first. `people` is fetched once by the parent screen
 * (`ManagerSituationScreen`) and shared with its own "In palestra ora"/"Occupazione" stat cards,
 * instead of this list polling a second, independent copy of the same data that could show a
 * slightly different count for a moment.
 */
export function PresenceList({ siteId, people, error }: { siteId: string; people: readonly PresentPerson[] | null; error: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const appActive = useAppActive();
  // Its own per-second clock for the stopwatch, independent of the roster poll and of the parent
  // screen's 30s band clock: at 30s the digits visibly "stopped" for long stretches then jumped,
  // which read as broken rather than live.
  const nowMs = useNow(1000, appActive);

  if (error) return null;
  if (!people) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>{t('manager.presence.title')}</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LiveDot color={theme.primary} />
          <AppText variant="caption" muted>
            {t('manager.presence.count', { n: people.length })}
          </AppText>
        </View>
      </View>

      {people.length === 0 ? (
        <AppText muted style={{ fontSize: 14 }}>
          {t('manager.presence.empty')}
        </AppText>
      ) : (
        <ScrollView style={{ height: PRESENCE_LIST_HEIGHT }} contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
          {people.map((p) => {
            const isCoach = p.kind === 'coach';
            const tint = isCoach ? theme.accent : theme.primary;
            const onTint = isCoach ? theme.onAccent : theme.onPrimary;
            const seconds = elapsedSecondsSince({ siteId, checkinAt: p.checkinAt, lastConfirmedAt: p.checkinAt }, nowMs);
            return (
              <View
                key={p.userId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.card,
                  backgroundColor: theme.glass,
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                }}>
                <Avatar uri={p.avatarUrl} name={p.fullName} size={44} tint={tint} onTint={onTint} />
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
                    {p.fullName ?? t('common.unnamedPerson')}
                  </AppText>
                  <AppText variant="caption" muted>
                    {t(isCoach ? 'manager.requests.role.coach' : 'manager.requests.role.client')}
                  </AppText>
                </View>
                <TimerRing
                  label={formatClockMinutes(seconds)}
                  size={60}
                  colors={[theme.band.green.solid, theme.band.amber.solid, theme.band.red.solid]}
                  rotationDeg={(seconds % 60) * 6}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { SectionLabel } from '@/components/Card';
import { LiveDot } from '@/components/LiveDot';
import { TimerRing } from '@/components/TimerRing';
import { elapsedSecondsSince, formatStopwatch } from '@/lib/domain/checkin';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

import { getPresentPeople, type PresentPerson } from './manager-api';

const POLL_MS = 20_000;

/**
 * Page 1's "chi c'è ora" list: everyone with an open check-in at the gym right now, clients and
 * coaches together, newest first. Polls rather than subscribing (no realtime channel in this
 * project's allowed dependency set) — good enough for a manager glancing at the room.
 */
export function PresenceList({ siteId }: { siteId: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const appActive = useAppActive();
  // Its own per-second clock for the stopwatch, independent of the list's 20s roster poll above and
  // of the parent screen's 30s band clock: at 30s the digits visibly "stopped" for long stretches
  // then jumped, which read as broken rather than live.
  const nowMs = useNow(1000, appActive);
  const [people, setPeople] = useState<PresentPerson[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      getPresentPeople(siteId).then(
        (p) => alive && setPeople(p),
        () => alive && setError(true)
      );
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId]);

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
        <View style={{ gap: spacing.sm }}>
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
                  label={formatStopwatch(seconds)}
                  size={60}
                  colors={[theme.band.green.solid, theme.band.amber.solid, theme.band.red.solid]}
                  rotationDeg={(seconds % 60) * 6}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

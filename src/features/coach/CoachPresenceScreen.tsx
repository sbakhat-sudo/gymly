import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { LogInIcon, LogOutIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { CheckInButton } from '@/features/checkin/CheckInButton';
import { useAuth } from '@/lib/auth/auth-context';
import { getOpenCheckin, getOwnCheckinHistory, realCheckIn, realCheckOut, type OpenCheckin } from '@/lib/checkins-api';
import { elapsedSecondsSince, formatStopwatch, intervalSeconds, startOfWeek } from '@/lib/domain/checkin';
import { isGymOpenNow, usePolledSiteStatus } from '@/lib/gym-status';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { usePageHeader } from '@/lib/page-header-context';
import { spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { CoachProfileCard, CoachStatsCard } from './CoachPresenceCards';

/**
 * Coach's own work-presence: check in/out for the shift, never tied to (or affecting) the gym's
 * occupancy band — a real `checkins` row with `kind: 'coach'`, distinct from a client's row, so the
 * simulated band never counts it. This is what feeds the Manager's "chi c'è ora" list. Three cards:
 * identity (left), the check-in/check-out action itself (middle), and real hours worked (right) —
 * side by side in sidebar/wide mode, stacked in narrow/native, same three cards either way.
 */
export function CoachPresenceScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const appActive = useAppActive();
  const now = useNow(1000, appActive);
  const isSidebar = useSidebarMode();
  const router = useRouter();
  // Sidebar mode's fixed `RoleTopBar` already shows a title (this same `usePageHeader` call feeds
  // it) while this tab is active — the inline title below is only for narrow/native, where there's
  // no top bar to show one. Rendering both at once duplicated "Presenza" on screen.
  usePageHeader(LogInIcon, t('tab.coach.home'));

  const [record, setRecord] = useState<OpenCheckin | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const fullName = auth.status === 'active' ? auth.profile.fullName || t('common.unnamedPerson') : t('common.unnamedPerson');
  const avatarUrl = auth.status === 'active' ? auth.profile.avatarUrl : null;

  const { site } = usePolledSiteStatus(siteId);

  const shifts = useAsync(
    () => (userId && siteId ? getOwnCheckinHistory(userId, siteId, 'coach') : Promise.resolve([])),
    [userId, siteId],
    userId !== null && siteId !== null
  );

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

  // The server checks a Coach out the moment the gym closes: while a shift is open, look again every 30 seconds and,
  // once it is gone, go back to "check-in" with a notice.
  const [autoClosed, setAutoClosed] = useState(false);
  useEffect(() => {
    if (!userId || !siteId || !record || !appActive) return;
    let alive = true;
    const openId = record.id;
    const check = (): void => {
      getOpenCheckin(userId, siteId, 'coach').then(
        (current) => {
          if (!alive || (current && current.id === openId)) return;
          if (current) {
            setRecord(current);
            return;
          }
          setRecord(null);
          setAutoClosed(true);
          shifts.reload();
        },
        () => undefined
      );
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shifts.reload` is a fresh function every render; only the open shift and who is signed in should restart this.
  }, [userId, siteId, record, appActive]);

  async function toggle(): Promise<void> {
    if (!userId || !siteId) return;
    setBusy(true);
    setError(false);
    setAutoClosed(false);
    try {
      if (record) {
        await realCheckOut(record.id);
        setRecord(null);
      } else {
        const next = await realCheckIn(userId, siteId, 'coach');
        setRecord(next);
      }
      shifts.reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = record !== null && record !== undefined;
  // Nobody checks in while the gym is closed (the database refuses it too); ending a shift stays possible.
  const closedBlock = !checkedIn && site !== null && !isGymOpenNow(site, now);
  const elapsedLabel = record ? formatStopwatch(elapsedSecondsSince({ siteId: siteId ?? '', checkinAt: record.checkinAt, lastConfirmedAt: record.checkinAt }, now)) : null;

  // Today/this-week/weekly-average, all from the same real shift history `CoachHoursScreen`'s
  // register uses — "today" by local calendar day, same plain-Date convention `startOfWeek` already
  // uses for "this week" (no site-timezone conversion, consistent with that existing screen).
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const weekStartMs = startOfWeek(now);
  const allShifts = shifts.data ?? [];
  const todaySeconds = allShifts.filter((s) => Date.parse(s.checkinAt) >= todayStartMs).reduce((sum, s) => sum + intervalSeconds(s.checkinAt, s.checkoutAt, now), 0);
  const weekSeconds = allShifts.filter((s) => Date.parse(s.checkinAt) >= weekStartMs).reduce((sum, s) => sum + intervalSeconds(s.checkinAt, s.checkoutAt, now), 0);
  const weekTotals = new Map<number, number>();
  for (const s of allShifts) {
    const wk = startOfWeek(Date.parse(s.checkinAt));
    weekTotals.set(wk, (weekTotals.get(wk) ?? 0) + intervalSeconds(s.checkinAt, s.checkoutAt, now));
  }
  const weeklyAverageSeconds = weekTotals.size > 0 ? [...weekTotals.values()].reduce((a, b) => a + b, 0) / weekTotals.size : 0;

  return (
    <Screen orb={!isSidebar && checkedIn ? { color: theme.band.red.solid, top: 82, size: 360 } : undefined}>
      {!isSidebar ? (
        <AppText variant="display" accessibilityRole="header">
          {t('coach.presence.title')}
        </AppText>
      ) : null}

      {autoClosed ? <Banner message={t('coach.presence.autoClosed')} /> : null}
      {closedBlock ? <Banner message={t('checkin.closed')} /> : null}
      {error ? <Banner message={t('checkin.error.generic')} /> : null}

      <View style={{ flexDirection: isSidebar ? 'row' : 'column', alignItems: isSidebar ? 'stretch' : undefined, gap: spacing.lg }}>
        <CoachProfileCard
          fullName={fullName}
          avatarUrl={avatarUrl}
          checkedIn={checkedIn}
          checkinAt={record?.checkinAt ?? null}
          siteName={site?.name ?? null}
          lang={lang}
          onViewProfile={() => router.push('/impostazioni')}
        />

        <View style={{ flex: isSidebar ? 1 : undefined, alignItems: 'center', gap: spacing.sm }}>
          <CheckInButton
            checkedIn={checkedIn}
            busy={busy || record === undefined || closedBlock}
            elapsedLabel={elapsedLabel}
            label={checkedIn ? t('checkin.button.out') : t('checkin.button.in')}
            accessibilityLabel={t(checkedIn ? 'coach.presence.out.a11y' : 'coach.presence.in.a11y')}
            onPress={() => void toggle()}
          />
          {checkedIn && elapsedLabel ? (
            <>
              <AppText muted accessibilityLabel={t('checkin.since.a11y', { time: elapsedLabel })} style={{ fontSize: 14, marginTop: -8 }}>
                {t('checkin.since')} {elapsedLabel}
              </AppText>
              <Pressable
                onPress={() => void toggle()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('coach.presence.out.a11y')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: busy ? 0.5 : 1 }}>
                <AppText color={theme.band.red.solid} style={{ fontWeight: '700', fontSize: 14 }}>
                  {t('coach.presence.endSession')}
                </AppText>
                <LogOutIcon color={theme.band.red.solid} size={15} />
              </Pressable>
            </>
          ) : null}
        </View>

        <CoachStatsCard todaySeconds={todaySeconds} weekSeconds={weekSeconds} weeklyAverageSeconds={weeklyAverageSeconds} />
      </View>
    </Screen>
  );
}

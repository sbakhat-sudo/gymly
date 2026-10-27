import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { DateBadge } from '@/components/DateBadge';
import { CheckIcon, ClockIcon, DownloadIcon, PulseIcon, SearchIcon, SlidersIcon, UsersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth/auth-context';
import { formatHoursDuration, formatHoursMinutes, intervalSeconds, startOfWeek } from '@/lib/domain/checkin';
import { formatShortDate } from '@/lib/format';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { isOnDateKey, useSelectedDate } from '@/lib/selected-date-context';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/lib/theme';
import { downloadXlsx } from '@/lib/xlsx';

import { ManagerNotifications } from './ManagerNotifications';
import { getCoachShifts, type CoachShift } from './manager-api';

function shiftSeconds(shift: CoachShift, nowMs: number): number {
  return intervalSeconds(shift.checkinAt, shift.checkoutAt, nowMs);
}

export function WorkHoursScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;
  const [search, setSearch] = useState('');
  const [oldestFirst, setOldestFirst] = useState(false);

  const { dateKey } = useSelectedDate();
  const shifts = useAsync(() => (siteId ? getCoachShifts(siteId) : Promise.resolve([])), [siteId], siteId !== null);
  const all = shifts.data ?? [];
  // The list/table below is scoped to the day picked from the top-bar date badge; everything else
  // on this screen (the stat cards, "on duty now") stays unaffected, off the full `all` — two
  // different, both useful, time scopes on the same data.
  const dayShifts = all.filter((s) => isOnDateKey(s.checkinAt, dateKey));

  // Minute-precision is enough for a historical register (unlike the live check-in stopwatch, which
  // ticks every second) — avoids re-rendering the whole list every second for no visible change.
  const appActive = useAppActive();
  const now = useNow(60_000, appActive);
  const weekStart = startOfWeek(now);
  const weekShifts = all.filter((s) => Date.parse(s.checkinAt) >= weekStart);
  const totalWeekSeconds = weekShifts.reduce((sum, s) => sum + shiftSeconds(s, now), 0);
  const daysLogged = new Set(weekShifts.map((s) => new Date(s.checkinAt).toDateString())).size;
  const avgDailySeconds = daysLogged > 0 ? totalWeekSeconds / daysLogged : 0;
  const onDutyNow = all.filter((s) => s.checkoutAt === null).length;

  const searchLower = search.trim().toLowerCase();
  const filtered = dayShifts
    .filter((s) => !searchLower || (s.coachName ?? '').toLowerCase().includes(searchLower))
    .sort((a, b) => (oldestFirst ? 1 : -1) * (Date.parse(a.checkinAt) - Date.parse(b.checkinAt)));

  function exportCsv(): void {
    const header = [
      t('manager.workHours.col.coach'),
      t('manager.workHours.col.date'),
      t('manager.workHours.col.checkin'),
      t('manager.workHours.col.checkout'),
      t('manager.workHours.col.hours'),
      t('manager.workHours.col.status'),
    ];
    const locale = lang === 'it' ? 'it-IT' : 'en-GB';
    const rows = dayShifts.map((s) => [
      s.coachName ?? t('common.unnamedPerson'),
      new Date(s.checkinAt).toLocaleDateString(locale),
      new Date(s.checkinAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      s.checkoutAt ? new Date(s.checkoutAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '',
      formatHoursDuration(shiftSeconds(s, now)),
      t(s.checkoutAt ? 'manager.workHours.status.done' : 'manager.workHours.status.open'),
    ]);
    downloadXlsx(t('manager.workHours.title').toLowerCase(), t('manager.workHours.title'), header, rows);
  }

  return (
    <Screen onRefresh={shifts.reload} refreshing={shifts.loading && shifts.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: 4 }}>
        <ScreenHeader icon={ClockIcon} label={t('manager.workHours.title')} notifications={<ManagerNotifications />} />
        <AppText muted style={{ fontSize: 14 }}>
          {t('manager.workHours.subtitle')}
        </AppText>
      </View>

      {shifts.error ? <Banner title={t('manager.workHours.error')} /> : null}
      {shifts.data === undefined && shifts.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}

      {shifts.data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <StatCard icon={<ClockIcon color={theme.primary} size={18} />} label={t('manager.workHours.stat.totalHours')} value={formatHoursMinutes(totalWeekSeconds)} />
          <StatCard icon={<UsersIcon color={theme.primary} size={18} />} label={t('manager.workHours.stat.daysLogged')} value={String(daysLogged)} />
          <StatCard icon={<CheckIcon color={theme.primary} size={18} />} label={t('manager.workHours.stat.avgDaily')} value={formatHoursMinutes(avgDailySeconds)} />
          <StatCard icon={<PulseIcon color={theme.primary} size={18} />} label={t('manager.workHours.stat.onDuty')} value={String(onDutyNow)} />
        </View>
      ) : null}

      {shifts.data ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <DateBadge />
          {dayShifts.length > 0 ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 50,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  flexGrow: 1,
                }}>
                <SearchIcon color={theme.textMuted} size={16} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('manager.workHours.search.placeholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('manager.workHours.search.placeholder')}
              autoComplete="off"
              textContentType="none"
              style={{ color: theme.text, fontSize: 14, minWidth: 160, flex: 1 }}
            />
          </View>
          <Pressable
            onPress={() => setOldestFirst(!oldestFirst)}
            accessibilityRole="button"
            accessibilityLabel={t(oldestFirst ? 'manager.workHours.sort.oldestFirst' : 'manager.workHours.sort.newestFirst')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 50,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}>
            <SlidersIcon color={theme.text} size={16} />
            <AppText style={{ fontWeight: '700' }}>{t(oldestFirst ? 'manager.workHours.sort.oldestFirst' : 'manager.workHours.sort.newestFirst')}</AppText>
          </Pressable>
          <Pressable
            onPress={exportCsv}
            accessibilityRole="button"
            accessibilityLabel={t('manager.workHours.export')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 50,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: theme.text,
            }}>
            <DownloadIcon color={theme.background} size={16} />
            <AppText color={theme.background} style={{ fontWeight: '700' }}>
              {t('manager.workHours.export')}
            </AppText>
          </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {shifts.data ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
              backgroundColor: theme.surfaceAlt,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ClockIcon color={theme.text} size={18} />
              <AppText style={{ fontWeight: '700' }}>{t('manager.workHours.panel.title')}</AppText>
            </View>
            <AppText variant="caption" muted>
              {t('manager.workHours.count', { n: dayShifts.length })}
            </AppText>
          </View>

          {dayShifts.length === 0 ? (
            <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.glassTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <ClockIcon color={theme.textMuted} size={26} />
              </View>
              <AppText style={{ fontWeight: '700', textAlign: 'center' }}>{t('manager.workHours.empty')}</AppText>
              <AppText variant="caption" muted style={{ textAlign: 'center', maxWidth: 320 }}>
                {t('manager.workHours.empty.sub')}
              </AppText>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.md }}>
                {([
                  ['manager.workHours.col.coach', 2.2],
                  ['manager.workHours.col.date', 1],
                  ['manager.workHours.col.checkin', 1],
                  ['manager.workHours.col.checkout', 1],
                  ['manager.workHours.col.hours', 1],
                  ['manager.workHours.col.status', 1.1],
                ] as const).map(([key, flex]) => (
                  <AppText key={key} variant="caption" muted style={{ flex, fontWeight: '700', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.4 }}>
                    {t(key)}
                  </AppText>
                ))}
              </View>

              {filtered.length === 0 ? (
                <AppText variant="caption" muted style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
                  {t('manager.workHours.noResults')}
                </AppText>
              ) : (
                filtered.map((s, i) => <ShiftRow key={s.id} shift={s} last={i === filtered.length - 1} now={now} />)
              )}
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 180, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <AppText variant="caption" muted numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant="display" style={{ fontSize: 26 }}>
        {value}
      </AppText>
    </Card>
  );
}

function ShiftRow({ shift, last, now }: { shift: CoachShift; last: boolean; now: number }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';
  const checkinTime = new Date(shift.checkinAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const checkoutTime = shift.checkoutAt ? new Date(shift.checkoutAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—';
  const open = shift.checkoutAt === null;
  const statusColor = open ? theme.band.amber.solid : theme.band.green.solid;
  const statusOn = open ? theme.band.amber.onSolid : theme.band.green.onSolid;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.border,
      }}>
      <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={shift.avatarUrl} name={shift.coachName} size={32} tint={theme.accent} onTint={theme.onAccent} />
        <AppText numberOfLines={1} style={{ fontWeight: '700', flexShrink: 1 }}>
          {shift.coachName ?? t('common.unnamedPerson')}
        </AppText>
      </View>
      <AppText numberOfLines={1} muted style={{ flex: 1, fontSize: 13 }}>
        {formatShortDate(lang, shift.checkinAt)}
      </AppText>
      <AppText numberOfLines={1} muted style={{ flex: 1, fontSize: 13 }}>
        {checkinTime}
      </AppText>
      <AppText numberOfLines={1} muted style={{ flex: 1, fontSize: 13 }}>
        {checkoutTime}
      </AppText>
      <AppText numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>
        {formatHoursMinutes(shiftSeconds(shift, now))}
      </AppText>
      <View style={{ flex: 1.1 }}>
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: statusColor,
          }}>
          <AppText numberOfLines={1} color={statusOn} style={{ fontSize: 11.5, fontWeight: '700' }}>
            {t(open ? 'manager.workHours.status.open' : 'manager.workHours.status.done')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { CheckIcon, ClockIcon, DownloadIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/lib/auth/auth-context';
import { getOwnCheckinHistory, type ShiftHistoryEntry } from '@/lib/checkins-api';
import { formatHoursDuration, formatHoursMinutes, intervalSeconds, startOfWeek } from '@/lib/domain/checkin';
import { formatShortDate } from '@/lib/format';
import { useAppActive, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { radius, spacing, useTheme } from '@/lib/theme';
import { downloadXlsx } from '@/lib/xlsx';

/** How tall the shift list grows before it scrolls inside its own card instead of pushing the rest
 * of the page down — a `maxHeight` is safe here (unlike the Manager Feedback coach card, which needed
 * a *fixed* height) because every row is plain text, with no async image that could resize a row
 * after the scroll area has already settled its bounds. */
const SHIFT_LIST_MAX_HEIGHT = 360;

/**
 * The Coach's own work-hours register — same data shape and columns as the Manager's
 * `WorkHoursScreen`, but scoped to the signed-in Coach's own rows (RLS `checkins_select_own`), with
 * no per-coach column or search/sort since it's just one person's history.
 */
export function CoachHoursScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const shifts = useAsync(
    () => (userId && siteId ? getOwnCheckinHistory(userId, siteId, 'coach') : Promise.resolve([])),
    [userId, siteId],
    userId !== null && siteId !== null
  );
  const all = shifts.data ?? [];

  const appActive = useAppActive();
  const now = useNow(60_000, appActive);
  const weekStart = startOfWeek(now);
  const weekShifts = all.filter((s) => Date.parse(s.checkinAt) >= weekStart);
  const totalWeekSeconds = weekShifts.reduce((sum, s) => sum + intervalSeconds(s.checkinAt, s.checkoutAt, now), 0);
  const daysLogged = new Set(weekShifts.map((s) => new Date(s.checkinAt).toDateString())).size;

  function exportCsv(): void {
    const header = [
      t('manager.workHours.col.date'),
      t('manager.workHours.col.checkin'),
      t('manager.workHours.col.checkout'),
      t('manager.workHours.col.hours'),
      t('manager.workHours.col.status'),
    ];
    const locale = lang === 'it' ? 'it-IT' : 'en-GB';
    const rows = all.map((s) => [
      new Date(s.checkinAt).toLocaleDateString(locale),
      new Date(s.checkinAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      s.checkoutAt ? new Date(s.checkoutAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '',
      formatHoursDuration(intervalSeconds(s.checkinAt, s.checkoutAt, now)),
      t(s.checkoutAt ? 'manager.workHours.status.done' : 'manager.workHours.status.open'),
    ]);
    downloadXlsx(t('coach.hours.title').toLowerCase(), t('coach.hours.title'), header, rows);
  }

  return (
    <Screen onRefresh={shifts.reload} refreshing={shifts.loading && shifts.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ScreenHeader icon={ClockIcon} label={t('coach.hours.title')} />
          {all.length > 0 ? (
            <Pressable
              onPress={exportCsv}
              accessibilityRole="button"
              accessibilityLabel={t('coach.hours.export')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.pill,
                backgroundColor: theme.text,
              }}>
              <DownloadIcon color={theme.background} size={16} />
              <AppText color={theme.background} style={{ fontWeight: '700' }}>
                {t('coach.hours.export')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <AppText muted style={{ fontSize: 14 }}>
          {t('coach.hours.subtitle')}
        </AppText>
      </View>

      {shifts.error ? <Banner title={t('coach.hours.error')} /> : null}
      {shifts.data === undefined && shifts.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}

      {shifts.data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <Card style={{ flexGrow: 1, flexBasis: 180, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ClockIcon color={theme.primary} size={18} />
              <AppText variant="caption" muted numberOfLines={1}>
                {t('coach.hours.stat.totalHours')}
              </AppText>
            </View>
            <AppText variant="display" style={{ fontSize: 26 }}>
              {formatHoursMinutes(totalWeekSeconds)}
            </AppText>
          </Card>
          <Card style={{ flexGrow: 1, flexBasis: 180, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CheckIcon color={theme.primary} size={18} />
              <AppText variant="caption" muted numberOfLines={1}>
                {t('coach.hours.stat.daysLogged')}
              </AppText>
            </View>
            <AppText variant="display" style={{ fontSize: 26 }}>
              {String(daysLogged)}
            </AppText>
          </Card>
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
              <AppText style={{ fontWeight: '700' }}>{t('coach.hours.panel.title')}</AppText>
            </View>
            <AppText variant="caption" muted>
              {t('coach.hours.count', { n: all.length })}
            </AppText>
          </View>

          {all.length === 0 ? (
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
              <AppText style={{ fontWeight: '700', textAlign: 'center' }}>{t('coach.hours.empty')}</AppText>
              <AppText variant="caption" muted style={{ textAlign: 'center', maxWidth: 320 }}>
                {t('coach.hours.empty.sub')}
              </AppText>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.md }}>
                {([
                  ['manager.workHours.col.date', 1.2],
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

              <ScrollView style={{ maxHeight: SHIFT_LIST_MAX_HEIGHT }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {all.map((s, i) => (
                  <ShiftRow key={s.id} shift={s} last={i === all.length - 1} now={now} />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function ShiftRow({ shift, last, now }: { shift: ShiftHistoryEntry; last: boolean; now: number }) {
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
      <AppText numberOfLines={1} style={{ flex: 1.2, fontWeight: '700', fontSize: 13 }}>
        {formatShortDate(lang, shift.checkinAt)}
      </AppText>
      <AppText numberOfLines={1} muted style={{ flex: 1, fontSize: 13 }}>
        {checkinTime}
      </AppText>
      <AppText numberOfLines={1} muted style={{ flex: 1, fontSize: 13 }}>
        {checkoutTime}
      </AppText>
      <AppText numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>
        {formatHoursMinutes(intervalSeconds(shift.checkinAt, shift.checkoutAt, now))}
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

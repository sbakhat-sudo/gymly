import { useRef, useState, type ElementRef } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';

import { formatDateKey } from '@/lib/domain/weekly-goal';
import { formatMonthYearLabel, formatTodayLabel, shortWeekdayLabels } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import {
  addMonths,
  daysInMonth,
  firstWeekdayOfMonth,
  monthOfDateKey,
  todayKey,
  useSelectedDate,
  type MonthKey,
} from '@/lib/selected-date-context';
import { radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

const POPOVER_WIDTH = 300;
const CELL_SIZE = 34;

function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function sameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Today's date (or whichever day is picked), as a small outlined "glass" pill — same neutral chip
 * treatment as `NotificationBell`. This one, unlike `TodayBadge` (the fixed, always-today, not
 * clickable one in `RoleTopBar`), is a real date *picker*: tapping it measures its own on-screen
 * position (`measureInWindow` — it's used inline in several different lists' own filter rows now,
 * not just one fixed spot) and opens a calendar-month grid right under wherever *this* particular
 * button actually is. Picking a day closes the popover and moves `SelectedDateProvider`'s shared
 * `dateKey`, which every list screen under the same role layout reads back, so switching tabs
 * doesn't silently reset it to today. Future days (and the month past the current one) are
 * disabled — there's nothing to show yet for a day that hasn't happened.
 */
export function DateBadge() {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { dateKey, setDateKey } = useSelectedDate();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const today = todayKey();
  const [viewMonth, setViewMonth] = useState<MonthKey>(() => monthOfDateKey(dateKey ?? today));
  const buttonRef = useRef<ElementRef<typeof Pressable>>(null);

  const label = dateKey === null ? t('datePicker.allDates') : formatTodayLabel(lang, dateKeyToDate(dateKey));
  const currentMonth = monthOfDateKey(today);
  const atCurrentMonth = sameMonth(viewMonth, currentMonth);

  function openPicker(): void {
    setViewMonth(monthOfDateKey(dateKey ?? today));
    buttonRef.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ top: y + height + 6, left: Math.min(x, windowWidth - POPOVER_WIDTH - spacing.lg) });
      setOpen(true);
    });
  }

  function pickDay(day: number): void {
    setDateKey(formatDateKey(new Date(viewMonth.year, viewMonth.month, day)));
    setOpen(false);
  }

  function clearFilter(): void {
    setDateKey(null);
    setOpen(false);
  }

  const leadingBlanks = firstWeekdayOfMonth(viewMonth);
  const totalDays = daysInMonth(viewMonth);

  return (
    <>
      <Pressable
        ref={buttonRef}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={t('datePicker.open')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 44,
          minWidth: 130,
          paddingHorizontal: 20,
          borderRadius: radius.pill,
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.glassBorder,
        }}>
        <CalendarIcon color={theme.textMuted} size={16} strokeWidth={2.2} />
        <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: '700' }}>
          {label}
        </AppText>
        <ChevronDownIcon color={theme.textMuted} size={16} strokeWidth={2.2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} style={{ flex: 1 }}>
          {/* A plain `View` here doesn't claim the touch responder, so tapping a day cell inside it
              would *also* be read as tapping the backdrop behind it — closing the popover before the
              tap could register as "pick this day". `Pressable` (no `onPress` of its own) claims it
              instead, same reason `ActionSheet`/`NotificationsSheet` wrap their own card in one. */}
          <Pressable
            accessible={false}
            style={{
              position: 'absolute',
              top: anchor.top,
              left: anchor.left,
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: theme.border,
              padding: spacing.md,
              gap: spacing.sm,
              width: POPOVER_WIDTH,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                onPress={() => setViewMonth((m) => addMonths(m, -1))}
                accessibilityRole="button"
                accessibilityLabel={t('datePicker.previousMonth')}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
                <ChevronLeftIcon color={theme.text} size={16} />
              </Pressable>
              <AppText style={{ fontSize: 14, fontWeight: '800' }}>{formatMonthYearLabel(lang, viewMonth.year, viewMonth.month)}</AppText>
              <Pressable
                onPress={() => setViewMonth((m) => addMonths(m, 1))}
                disabled={atCurrentMonth}
                accessibilityRole="button"
                accessibilityLabel={t('datePicker.nextMonth')}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.surfaceAlt,
                  opacity: atCurrentMonth ? 0.35 : 1,
                }}>
                <ChevronRightIcon color={theme.text} size={16} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row' }}>
              {shortWeekdayLabels(lang).map((w) => (
                <View key={w} style={{ width: CELL_SIZE, alignItems: 'center' }}>
                  <AppText variant="caption" muted style={{ fontSize: 11, fontWeight: '700' }}>
                    {w}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <View key={`blank-${i}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              ))}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const cellKey = formatDateKey(new Date(viewMonth.year, viewMonth.month, day));
                const isSelected = cellKey === dateKey;
                const isToday = cellKey === today;
                const isFuture = cellKey > today;
                return (
                  <Pressable
                    key={day}
                    onPress={() => pickDay(day)}
                    disabled={isFuture}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isFuture }}
                    accessibilityLabel={cellKey}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: CELL_SIZE / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? theme.text : 'transparent',
                      opacity: isFuture ? 0.3 : 1,
                    }}>
                    <AppText
                      color={isSelected ? theme.background : theme.text}
                      style={{ fontSize: 13, fontWeight: isToday || isSelected ? '800' : '500' }}>
                      {day}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={clearFilter}
              accessibilityRole="button"
              style={{ alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt }}>
              <AppText color={theme.primary} style={{ fontSize: 12, fontWeight: '700' }}>
                {t('datePicker.allDates')}
              </AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

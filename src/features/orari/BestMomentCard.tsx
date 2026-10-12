import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BandIcon } from '@/components/BandIcon';
import { BellIcon } from '@/components/icons';
import { Orb } from '@/components/Orb';
import { decorativeA11yProps } from '@/lib/a11y';
import { parseTime, zonedTimeToUtc } from '@/lib/domain/time';
import { useI18n } from '@/lib/i18n';
import { requestAlertPermission, scheduleWindowReminder } from '@/lib/notifications';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';

const LEAD_MINUTES = 30;

interface BestMomentCardProps {
  /** null = no free window that day: the card says so instead of showing a time. */
  window: { from: string; to: string } | null;
  /** "Momento migliore oggi" / "Momento migliore · martedì". */
  title: string;
  /** Shown when `window` is null ("Nessuna fascia libera prevista" / "Chiusa tutto il giorno"). */
  emptyText: string;
  siteName: string;
  timezone: string;
  /** The local date of the selected day (`YYYY-MM-DD`), to turn the window's clock time into an absolute instant. */
  dateKey: string;
}

/**
 * Hero card for the selected day's best free window (Aurora: surface card with a green glow, the
 * time in big display type). The band is always green by construction (it comes from the green-window
 * logic), shown with its shape + label. One tap schedules a one-off local reminder `LEAD_MINUTES`
 * before it starts; the button then reads "Avviso attivo".
 */
export function BestMomentCard({ window, title, emptyText, siteName, timezone, dateKey }: BestMomentCardProps) {
  const { t, lang, band: bandLabel } = useI18n();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'sent' | 'denied' | null>(null);
  const green = theme.band.green;

  async function remind(): Promise<void> {
    if (!window || notice === 'sent') return;
    setBusy(true);
    setNotice(null);
    const result = await requestAlertPermission();
    if (result !== 'granted') {
      setBusy(false);
      setNotice('denied');
      return;
    }
    const targetMinutes = Math.max(0, parseTime(window.from) - LEAD_MINUTES);
    const target = zonedTimeToUtc(dateKey, targetMinutes, timezone);
    const secondsFromNow = (target.getTime() - Date.now()) / 1000;
    const ok = await scheduleWindowReminder(lang, siteName, window.from, secondsFromNow);
    setBusy(false);
    setNotice(ok ? 'sent' : 'denied');
  }

  const active = notice === 'sent';

  return (
    <View style={{ borderRadius: 30, padding: 20, gap: 14, backgroundColor: theme.surface, overflow: 'hidden' }}>
      <View {...decorativeA11yProps} style={{ pointerEvents: 'none', position: 'absolute', top: -100, right: -90, width: 280, height: 280 }}>
        <Orb color={green.solid} size={280} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <AppText
          muted
          accessibilityRole="header"
          style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
          {title}
        </AppText>
        {window ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: green.soft }}>
            <BandIcon band="green" size={10} color={green.solid} />
            <AppText color={green.onSoft} style={{ fontSize: 12, fontWeight: '600' }}>
              {bandLabel('green')}
            </AppText>
          </View>
        ) : null}
      </View>

      {window ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap' }}>
            <AppText
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fontFamily.display, fontSize: 58, lineHeight: 58, letterSpacing: 58 * -0.07, fontVariant: ['tabular-nums'] }}>
              {window.from}
            </AppText>
            <AppText muted style={{ fontSize: 14, lineHeight: 18, paddingBottom: 6, flexShrink: 1 }}>
              {window.to === '24:00' ? t('schedule.bestMoment.untilClosing') : t('schedule.bestMoment.until', { time: window.to })}
            </AppText>
          </View>

          <Pressable
            onPress={() => void remind()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('schedule.bestMoment.remindA11y', { time: window.from })}
            accessibilityState={{ disabled: busy, selected: active }}
            style={({ pressed }) => ({
              height: 46,
              borderRadius: 23,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: active ? green.soft : theme.text,
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            })}>
            <BellIcon size={16} color={active ? green.onSoft : theme.background} strokeWidth={2.2} />
            <AppText color={active ? green.onSoft : theme.background} style={{ fontSize: 14, fontWeight: '700' }}>
              {active ? t('schedule.bestMoment.remindActive') : t('schedule.bestMoment.remind')}
            </AppText>
          </Pressable>
          {notice === 'denied' ? (
            <View accessibilityLiveRegion="polite">
              <AppText color={theme.danger} style={{ fontSize: 12, fontWeight: '600' }}>
                {t('schedule.reminder.denied')}
              </AppText>
            </View>
          ) : null}
        </>
      ) : (
        <AppText style={{ fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, letterSpacing: 24 * -0.05 }}>{emptyText}</AppText>
      )}
    </View>
  );
}

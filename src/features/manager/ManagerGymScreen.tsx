import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { GeofenceFields, parseGeofenceFields } from '@/components/GeofenceFields';
import { BellIcon, CheckIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { EndTimeOfDaySchema, TimeOfDaySchema, type OpeningHours, type Weekday } from '@/schemas';

import { getSiteGeofence, getSiteStatus, getSupportEmail, setManuallyOpen, setSiteCapacity, setSiteLocation, updateOpeningHours, type SiteStatus } from './manager-api';

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface DayRow {
  closed: boolean;
  opens: string;
  closes: string;
  /** Opens at 00:00 and closes at the schema's exclusive-midnight sentinel (24:00) — shown as one
   * checkbox instead of making the Manager type both times for the common "open all day" case. */
  allDay: boolean;
}

/** The real, DST-aware current UTC offset for a timezone ("GMT+1"/"GMT+2") — never hardcoded, since
 * Rome's offset itself changes twice a year. */
function tzOffsetLabel(timezone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
  return part?.value ?? '';
}

/** This screen only ever renders on web (Manager is a web-only role) — a plain `window.open` opens
 * the Manager's own mail client in a new tab without navigating Gymly away. */
function openMailto(email: string): void {
  if (Platform.OS === 'web') window.open(`mailto:${email}`, '_blank', 'noopener');
}

/** Small labelled checkbox — "Aperto 24h" and "Chiuso" share this same look on a day row. */
function LabeledCheckbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TAP }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: checked ? theme.primary : theme.border,
          backgroundColor: checked ? theme.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? <CheckIcon color={theme.onPrimary} size={11} strokeWidth={3} /> : null}
      </View>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The browser's own time picker (click to choose, no typing HH:MM by hand) — this screen only
 * ever renders on web (Manager is a web-only role), so a raw `<input>` is safe here without a
 * native fallback. `disabled` is used for the "chiude a mezzanotte" case below, where 24:00 can't
 * be represented by a native time input (its range is 00:00–23:59). */
function TimeField({
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <input
      type="time"
      value={disabled ? '' : value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={accessibilityLabel}
      style={{
        flex: 1,
        minHeight: MIN_TAP,
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: radius.md,
        paddingLeft: spacing.md,
        paddingRight: spacing.md,
        color: theme.text,
        fontFamily: fontFamily.mono,
        fontSize: 15,
        background: disabled ? theme.surfaceAlt : 'transparent',
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    />
  );
}

function rowsFromHours(hours: OpeningHours[]): Record<Weekday, DayRow> {
  const rows = {} as Record<Weekday, DayRow>;
  for (const w of WEEKDAYS) {
    const entry = hours.find((h) => h.weekday === w);
    rows[w] = entry
      ? { closed: false, opens: entry.opens_at, closes: entry.closes_at, allDay: entry.opens_at === '00:00' && entry.closes_at === '24:00' }
      : { closed: true, opens: '', closes: '', allDay: false };
  }
  return rows;
}

export function ManagerGymScreen() {
  const { t, weekday } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const siteId = auth.status === 'active' ? auth.profile.siteId : null;

  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<Record<Weekday, DayRow> | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursFeedback, setHoursFeedback] = useState<'saved' | 'error' | 'invalid' | null>(null);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusM, setRadiusM] = useState('150');
  const [locating, setLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<'saved' | 'error' | 'invalid' | 'permissionDenied' | null>(null);

  const [capacity, setCapacity] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacityFeedback, setCapacityFeedback] = useState<'saved' | 'error' | 'invalid' | null>(null);

  const [supportEmail, setSupportEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSupportEmail().then((email) => alive && setSupportEmail(email)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    getSiteStatus(siteId).then(
      (s) => {
        if (!alive) return;
        setStatus(s);
        setRows(rowsFromHours(s.openingHours));
        setCapacity(String(s.capacityReference));
      },
      () => alive && setLoadError(true)
    );
    getSiteGeofence(siteId).then((g) => {
      if (!alive || !g) return;
      setLat(String(g.lat));
      setLng(String(g.lng));
      setRadiusM(String(g.radius));
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [siteId]);

  async function toggleOpen(next: boolean): Promise<void> {
    if (!siteId || !status) return;
    setTogglingOpen(true);
    try {
      await setManuallyOpen(siteId, next);
      setStatus({ ...status, manuallyOpen: next });
    } finally {
      setTogglingOpen(false);
    }
  }

  async function saveHours(): Promise<void> {
    if (!siteId || !rows) return;
    setHoursFeedback(null);
    const hours: OpeningHours[] = [];
    for (const w of WEEKDAYS) {
      const row = rows[w];
      if (row.closed) continue;
      const opens = row.allDay ? '00:00' : row.opens;
      const closes = row.allDay ? '24:00' : row.closes;
      if (!TimeOfDaySchema.safeParse(opens).success || !EndTimeOfDaySchema.safeParse(closes).success) {
        setHoursFeedback('invalid');
        return;
      }
      hours.push({ weekday: w, opens_at: opens, closes_at: closes });
    }
    setSavingHours(true);
    try {
      await updateOpeningHours(siteId, hours);
      setHoursFeedback('saved');
    } catch {
      setHoursFeedback('error');
    } finally {
      setSavingHours(false);
    }
  }

  async function locateMe(): Promise<void> {
    setLocationFeedback(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationFeedback('permissionDenied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(String(position.coords.latitude));
      setLng(String(position.coords.longitude));
    } catch {
      setLocationFeedback('error');
    } finally {
      setLocating(false);
    }
  }

  async function saveLocation(): Promise<void> {
    if (!siteId) return;
    setLocationFeedback(null);
    const parsed = parseGeofenceFields(lat, lng, radiusM);
    if (!parsed) {
      setLocationFeedback('invalid');
      return;
    }
    setSavingLocation(true);
    try {
      await setSiteLocation(siteId, parsed.lat, parsed.lng, parsed.radiusM);
      setLocationFeedback('saved');
    } catch {
      setLocationFeedback('error');
    } finally {
      setSavingLocation(false);
    }
  }

  async function saveCapacity(): Promise<void> {
    if (!siteId) return;
    setCapacityFeedback(null);
    const n = Number(capacity);
    if (!Number.isInteger(n) || n < 1) {
      setCapacityFeedback('invalid');
      return;
    }
    setSavingCapacity(true);
    try {
      await setSiteCapacity(siteId, n);
      setCapacityFeedback('saved');
    } catch {
      setCapacityFeedback('error');
    } finally {
      setSavingCapacity(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <Banner title={t('manager.gym.error')} />
      </Screen>
    );
  }
  if (!status || !rows) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="display" style={{ fontSize: 32, flexShrink: 1 }}>
          {t('manager.opening.title')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {supportEmail ? (
            <Pressable
              onPress={() => openMailto(supportEmail)}
              accessibilityRole="button"
              accessibilityLabel={t('manager.gym.support')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minHeight: 50,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.pill,
                backgroundColor: theme.surfaceAlt,
              }}>
              <BellIcon color={theme.text} size={18} />
              <AppText style={{ fontWeight: '700' }}>{t('manager.gym.support')}</AppText>
            </Pressable>
          ) : null}
          <Button label={t('manager.gym.hours.save')} onPress={() => void saveHours()} disabled={savingHours} />
        </View>
      </View>

      {status.approvalStatus !== 'active' ? (
        <Banner
          title={t(status.approvalStatus === 'suspended' ? 'manager.gym.suspended.title' : 'manager.gym.pendingApproval.title')}
          message={t(status.approvalStatus === 'suspended' ? 'manager.gym.suspended.body' : 'manager.gym.pendingApproval.body')}
        />
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <SectionTitle>{t('manager.gym.toggle.title')}</SectionTitle>
            <AppText variant="caption" muted>
              {t('manager.gym.toggle.help')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: status.manuallyOpen ? theme.band.green.soft : theme.surfaceAlt,
              }}>
              <AppText
                color={status.manuallyOpen ? theme.band.green.onSoft : theme.textMuted}
                style={{ fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>
                {t(status.manuallyOpen ? 'manager.gym.toggle.open' : 'manager.gym.toggle.closed')}
              </AppText>
            </View>
            <Toggle
              value={status.manuallyOpen}
              onValueChange={(v) => void toggleOpen(v)}
              disabled={togglingOpen}
              accessibilityLabel={t(status.manuallyOpen ? 'manager.gym.toggle.open' : 'manager.gym.toggle.closed')}
            />
          </View>
        </View>
        <Banner message={t('manager.gym.toggle.info')} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <SectionTitle>{t('manager.gym.hours.title')}</SectionTitle>
          <AppText variant="caption" muted>
            {t('manager.gym.hours.timezone', { tz: status.timezone, offset: tzOffsetLabel(status.timezone) })}
          </AppText>
        </View>
        {WEEKDAYS.map((w) => {
          const row = rows[w];
          return (
            <View key={w} style={{ gap: spacing.xs, paddingVertical: spacing.xs, borderTopWidth: w > 0 ? 1 : 0, borderTopColor: theme.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText style={{ fontWeight: '600', textTransform: 'capitalize' }}>{weekday(w)}</AppText>
                <Toggle
                  value={!row.closed}
                  onValueChange={(open) =>
                    setRows({ ...rows, [w]: open ? { closed: false, opens: '09:00', closes: '18:00', allDay: false } : { closed: true, opens: '', closes: '', allDay: false } })
                  }
                  accessibilityLabel={`${weekday(w)}: ${t(row.closed ? 'manager.gym.hours.closedDay' : 'manager.gym.toggle.open')}`}
                />
              </View>
              {!row.closed && !row.allDay ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <TimeField
                      value={row.opens}
                      onChange={(v) => setRows({ ...rows, [w]: { ...row, opens: v } })}
                      accessibilityLabel={`${weekday(w)}: ${t('manager.gym.hours.opens')}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeField
                      value={row.closes}
                      onChange={(v) => setRows({ ...rows, [w]: { ...row, closes: v } })}
                      accessibilityLabel={`${weekday(w)}: ${t('manager.gym.hours.closes')}`}
                    />
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                <LabeledCheckbox
                  checked={!row.closed && row.allDay}
                  label={t('manager.gym.hours.allDay')}
                  onToggle={() => setRows({ ...rows, [w]: row.closed ? { closed: false, opens: '00:00', closes: '24:00', allDay: true } : { ...row, allDay: !row.allDay } })}
                />
                <LabeledCheckbox
                  checked={row.closed}
                  label={t('manager.gym.hours.closedDay')}
                  onToggle={() =>
                    setRows({ ...rows, [w]: row.closed ? { closed: false, opens: '09:00', closes: '18:00', allDay: false } : { closed: true, opens: '', closes: '', allDay: false } })
                  }
                />
              </View>
            </View>
          );
        })}
        {hoursFeedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={hoursFeedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(hoursFeedback === 'saved' ? 'manager.gym.hours.saved' : hoursFeedback === 'invalid' ? 'manager.gym.hours.invalid' : 'manager.gym.hours.error')}
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t('manager.gym.location.title')}</SectionTitle>
        <AppText variant="caption" muted>
          {t('manager.gym.location.help')}
        </AppText>

        <GeofenceFields lat={lat} onLatChange={setLat} lng={lng} onLngChange={setLng} radiusM={radiusM} onRadiusChange={setRadiusM} />

        <Button label={t('manager.gym.location.useMine')} variant="secondary" onPress={() => void locateMe()} disabled={locating} />

        {locationFeedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={locationFeedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(
                locationFeedback === 'saved'
                  ? 'manager.gym.location.saved'
                  : locationFeedback === 'invalid'
                    ? 'manager.gym.location.invalid'
                    : locationFeedback === 'permissionDenied'
                      ? 'manager.gym.location.permissionDenied'
                      : 'manager.gym.location.error'
              )}
            </AppText>
          </View>
        ) : null}

        <Button label={t('manager.gym.location.save')} onPress={() => void saveLocation()} disabled={savingLocation} />
      </Card>

      <Card>
        <SectionTitle>{t('manager.gym.capacity.title')}</SectionTitle>
        <AppText variant="caption" muted>
          {t('manager.gym.capacity.help')}
        </AppText>

        <TextInput
          value={capacity}
          onChangeText={(v) => {
            setCapacity(v.replace(/[^0-9]/g, ''));
            setCapacityFeedback(null);
          }}
          placeholder="50"
          accessibilityLabel={t('manager.gym.capacity.title')}
          keyboardType="number-pad"
          style={{
            minHeight: MIN_TAP,
            borderWidth: 1.5,
            borderColor: capacityFeedback === 'invalid' ? theme.danger : theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            color: theme.text,
            fontFamily: fontFamily.mono,
            fontSize: 15,
          }}
        />

        {capacityFeedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={capacityFeedback === 'saved' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(
                capacityFeedback === 'saved'
                  ? 'manager.gym.capacity.saved'
                  : capacityFeedback === 'invalid'
                    ? 'manager.gym.capacity.invalid'
                    : 'manager.gym.capacity.error'
              )}
            </AppText>
          </View>
        ) : null}

        <Button label={t('manager.gym.capacity.save')} onPress={() => void saveCapacity()} disabled={savingCapacity} />
      </Card>
    </Screen>
  );
}

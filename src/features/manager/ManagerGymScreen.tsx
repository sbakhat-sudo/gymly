import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Card, SectionTitle } from '@/components/Card';
import { parseGeofenceFields } from '@/components/GeofenceFields';
import { BellIcon, CheckIcon, ChevronRightIcon, HomeIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { geocodeAddress } from '@/lib/supabase/address-suggest';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { EndTimeOfDaySchema, TimeOfDaySchema, type OpeningHours, type Weekday } from '@/schemas';

import { GymOpenStateNote } from './GymOpenStateNote';
import { ManagerNotifications } from './ManagerNotifications';
import { ManagerPositionCard } from './ManagerPositionCard';
import {
  getChainSites,
  getPresentPeople,
  getSiteAddress,
  getSiteGeofence,
  getSiteStatus,
  getSupportEmail,
  setManuallyOpen,
  setSiteLocation,
  updateOpeningHours,
  type ChainSites,
  type SiteStatus,
} from './manager-api';

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface DayRow {
  closed: boolean;
  opens: string;
  closes: string;
  /** Opens at 00:00 and closes at the schema's exclusive-midnight sentinel (24:00) — shown as one
   * checkbox instead of making the Manager type both times for the common "open all day" case. */
  allDay: boolean;
}

/** The real, DST-aware current offset for a timezone ("UTC+1"/"UTC+2") — never hardcoded, since
 * Rome's offset itself changes twice a year. `Intl` labels this "GMT+1"; relabelled to the more
 * familiar "UTC+1" (the same offset, just the conventional wording in Italian UI copy). */
function tzOffsetLabel(timezone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
  return (part?.value ?? '').replace('GMT', 'UTC');
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
  const router = useRouter();
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
  // Only ever set by a real `getCurrentPositionAsync` fix (see `locateMe`) — `null` before that, read
  // as "unknown" rather than fabricating a precision figure for coordinates that were typed by hand
  // or loaded from a previous save.
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  // The address the Owner typed when adding this Manager; while the gym has no coordinates yet it pre-fills the
  // position card, and its position is looked up so Latitudine/Longitudine are not left empty.
  const [siteAddress, setSiteAddress] = useState<string | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState<boolean | null>(null);
  const [clientsPresent, setClientsPresent] = useState<number | null>(null);

  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [chainSites, setChainSites] = useState<ChainSites | null>(null);

  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => alive && setGpsAvailable(p.granted))
      .catch(() => alive && setGpsAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  // "Clienti entro raggio" — the only honest real number for it: everyone currently checked in
  // already passed the geofence check at check-in time, since nobody's position is tracked live.
  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    const load = (): void => {
      getPresentPeople(siteId).then(
        (people) => alive && setClientsPresent(people.filter((p) => p.kind === 'client').length),
        () => undefined
      );
    };
    load();
    const timer = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId]);

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
    getChainSites(siteId)
      .then((c) => alive && setChainSites(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    getSiteStatus(siteId).then(
      (s) => {
        if (!alive) return;
        setStatus(s);
        setRows(rowsFromHours(s.openingHours));
      },
      () => alive && setLoadError(true)
    );
    getSiteGeofence(siteId).then(async (g) => {
      if (!alive) return;
      if (g) {
        setLat(String(g.lat));
        setLng(String(g.lng));
        setRadiusM(String(g.radius));
        return;
      }
      const address = await getSiteAddress(siteId);
      if (!alive || !address) return;
      setSiteAddress(address);
      const found = await geocodeAddress(address);
      if (!alive || !found) return;
      setLat(found.lat.toFixed(6));
      setLng(found.lng.toFixed(6));
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
      setAccuracyM(position.coords.accuracy);
      setGpsAvailable(true);
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
        <ScreenHeader icon={HomeIcon} label={t('manager.opening.title')} notifications={<ManagerNotifications />} />
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
          <Pressable
            onPress={() => void saveHours()}
            disabled={savingHours}
            accessibilityRole="button"
            accessibilityLabel={t('manager.gym.hours.save')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 50,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              backgroundColor: theme.primary,
              opacity: savingHours ? 0.6 : 1,
            }}>
            <CheckIcon color={theme.onPrimary} size={16} strokeWidth={2.4} />
            <AppText color={theme.onPrimary} style={{ fontWeight: '700' }}>
              {t('manager.gym.hours.save')}
            </AppText>
          </Pressable>
        </View>
      </View>

      {status.approvalStatus !== 'active' ? (
        <Banner
          title={t(status.approvalStatus === 'suspended' ? 'manager.gym.suspended.title' : 'manager.gym.pendingApproval.title')}
          message={t(status.approvalStatus === 'suspended' ? 'manager.gym.suspended.body' : 'manager.gym.pendingApproval.body')}
        />
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <SectionTitle>{t('manager.gym.toggle.title')}</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: theme.border,
              }}>
              <AppText variant="caption" muted style={{ fontWeight: '700', letterSpacing: 0.4 }}>
                {t('manager.gym.toggle.open').toUpperCase()} / {t('manager.gym.toggle.closed').toUpperCase()}
              </AppText>
              <Toggle
                value={status.manuallyOpen}
                onValueChange={(v) => void toggleOpen(v)}
                disabled={togglingOpen}
                accessibilityLabel={t(status.manuallyOpen ? 'manager.gym.toggle.open' : 'manager.gym.toggle.closed')}
              />
            </View>
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
          </View>
        </View>
        <GymOpenStateNote status={status} />
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
          const fieldsDisabled = row.closed || row.allDay;
          return (
            <View
              key={w}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: w > 0 ? 1 : 0,
                borderTopColor: theme.border,
                flexWrap: 'wrap',
              }}>
              <AppText style={{ fontWeight: '600', textTransform: 'capitalize', width: 92 }}>{weekday(w)}</AppText>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 220 }}>
                <View style={{ flex: 1 }}>
                  <TimeField
                    value={row.opens}
                    onChange={(v) => setRows({ ...rows, [w]: { ...row, opens: v } })}
                    accessibilityLabel={`${weekday(w)}: ${t('manager.gym.hours.opens')}`}
                    disabled={fieldsDisabled}
                  />
                </View>
                <AppText muted>–</AppText>
                <View style={{ flex: 1 }}>
                  <TimeField
                    value={row.closes}
                    onChange={(v) => setRows({ ...rows, [w]: { ...row, closes: v } })}
                    accessibilityLabel={`${weekday(w)}: ${t('manager.gym.hours.closes')}`}
                    disabled={fieldsDisabled}
                  />
                </View>
              </View>

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

              <Toggle
                value={!row.closed}
                onValueChange={(open) =>
                  setRows({ ...rows, [w]: open ? { closed: false, opens: '09:00', closes: '18:00', allDay: false } : { closed: true, opens: '', closes: '', allDay: false } })
                }
                accessibilityLabel={`${weekday(w)}: ${t(row.closed ? 'manager.gym.hours.closedDay' : 'manager.gym.toggle.open')}`}
              />
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

      <ManagerPositionCard
        key={siteAddress ?? 'no-address'}
        initialAddress={siteAddress}
        lat={lat}
        onLatChange={setLat}
        lng={lng}
        onLngChange={setLng}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        accuracyM={accuracyM}
        gpsAvailable={gpsAvailable}
        clientsPresent={clientsPresent}
        locating={locating}
        saving={savingLocation}
        onLocateMe={() => void locateMe()}
        onSave={() => void saveLocation()}
        feedback={locationFeedback}
      />

      <Pressable
        onPress={() => router.push('/capienza')}
        accessibilityRole="button"
        accessibilityLabel={t('manager.gym.capacity.navButton')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: 18,
          borderRadius: radius.card,
          backgroundColor: theme.surface,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <SectionTitle>{t('manager.gym.capacity.navTitle')}</SectionTitle>
          <AppText variant="caption" muted>
            {t('manager.gym.capacity.navHelp')}
          </AppText>
        </View>
        <ChevronRightIcon color={theme.textMuted} size={20} />
      </Pressable>

      {chainSites && chainSites.siblings.length > 0 ? (
        <Card>
          <SectionTitle>{t('manager.gym.chain.title', { name: chainSites.chainName })}</SectionTitle>
          <AppText variant="caption" muted>
            {t('manager.gym.chain.help')}
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {chainSites.siblings.map((s) => (
              <View
                key={s.siteId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText numberOfLines={1} style={{ fontWeight: '700' }}>
                    {s.name}
                  </AppText>
                  {s.address ? (
                    <AppText variant="caption" muted numberOfLines={1}>
                      {s.address}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="caption" muted numberOfLines={1} style={{ maxWidth: 140, textAlign: 'right' }}>
                  {s.managerName ?? t('common.unnamedPerson')}
                </AppText>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

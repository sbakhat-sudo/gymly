import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { ChevronDownIcon, EyeIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { getGpsAuditLog, getSites, type GpsAuditEntry } from './admin-api';

function formatCoords(lat: number | null, lng: number | null, radiusM: number | null): string {
  if (lat === null || lng === null || radiusM === null) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${radiusM}m)`;
}

/**
 * Read-only trail of every GPS geofence change (Manager's own gym, or Admin's on any gym) —
 * `gps_audit_log`, written atomically by `manager_set_site_location`/`admin_set_site_location` (see
 * the migration). Admin-only: `admin_get_gps_audit_log` raises if the caller isn't one. There's no
 * separate "super-admin" tier in this app today, so this is readable by the same Admin role that can
 * make the change in the first place — see the migration's comment for that trade-off.
 */
export function AdminGpsAuditScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sites = useAsync(() => getSites(), []);
  const log = useAsync(() => getGpsAuditLog(siteId), [siteId]);

  const selectedSiteName = siteId ? (sites.data?.find((s) => s.siteId === siteId)?.name ?? siteId) : t('admin.gpsAudit.filter.allSites');

  return (
    <Screen onRefresh={log.reload} refreshing={log.loading && log.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <BackButton href="/(admin)/impostazioni" />
        <PageTitle icon={EyeIcon} label={t('admin.gpsAudit.title')} />
        <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
          {t('admin.gpsAudit.subtitle')}
        </AppText>
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('admin.gpsAudit.filter.site')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}>
        <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
          {selectedSiteName}
        </AppText>
        <ChevronDownIcon color={theme.textMuted} size={16} />
      </Pressable>

      {log.error ? <Banner title={t('admin.gpsAudit.error')} /> : null}
      {log.data === undefined && log.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {log.data && log.data.length === 0 ? <Banner message={t('admin.gpsAudit.empty')} /> : null}

      {log.data && log.data.length > 0 ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }}>
          {log.data.map((entry, i, rows) => (
            <AuditRow key={entry.id} entry={entry} last={i === rows.length - 1} />
          ))}
        </View>
      ) : null}

      <ActionSheet
        visible={pickerOpen}
        title={t('admin.gpsAudit.filter.site')}
        onClose={() => setPickerOpen(false)}
        actions={[
          { label: t('admin.gpsAudit.filter.allSites'), onPress: () => { setSiteId(null); setPickerOpen(false); } },
          ...(sites.data ?? []).map((s) => ({
            label: s.name,
            onPress: () => {
              setSiteId(s.siteId);
              setPickerOpen(false);
            },
          })),
        ]}
      />
    </Screen>
  );
}

function AuditRow({ entry, last }: { entry: GpsAuditEntry; last: boolean }) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  return (
    <View
      style={{
        padding: spacing.md,
        gap: 6,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.border,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <AppText numberOfLines={1} style={{ fontWeight: '700', flex: 1 }}>
          {entry.siteName}
        </AppText>
        <AppText variant="caption" muted>
          {new Date(entry.changedAt).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}
        </AppText>
      </View>
      <AppText variant="caption" muted>
        {t('admin.gpsAudit.col.who')}: {entry.changedByName ?? t('admin.gpsAudit.unknownAdmin')}
      </AppText>
      <AppText style={{ fontSize: 12.5 }}>
        {t('admin.gpsAudit.col.before')}: {formatCoords(entry.oldLat, entry.oldLng, entry.oldRadius)}
      </AppText>
      <AppText style={{ fontSize: 12.5, fontWeight: '600' }}>
        {t('admin.gpsAudit.col.after')}: {formatCoords(entry.newLat, entry.newLng, entry.newRadius)}
      </AppText>
      {entry.userAgent ? (
        <AppText variant="caption" muted numberOfLines={1}>
          {t('admin.gpsAudit.col.device')}: {entry.userAgent}
        </AppText>
      ) : null}
    </View>
  );
}

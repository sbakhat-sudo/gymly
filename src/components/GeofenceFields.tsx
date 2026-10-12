import { TextInput, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface GeofenceFieldsProps {
  lat: string;
  onLatChange: (v: string) => void;
  lng: string;
  onLngChange: (v: string) => void;
  radiusM: string;
  onRadiusChange: (v: string) => void;
}

/** The three labelled lat/lng/radius fields shared by the Manager's own "Posizione palestra" (in
 * ManagerGymScreen) and the Admin's per-site editor (in AdminSitesScreen) — same inputs either
 * way, only who's allowed to save them (and whether a "use my location" shortcut makes sense)
 * differs, so those stay with each caller instead of living in here. */
export function GeofenceFields({ lat, onLatChange, lng, onLngChange, radiusM, onRadiusChange }: GeofenceFieldsProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const inputStyle = {
    minHeight: MIN_TAP,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontFamily: fontFamily.mono,
    fontSize: 15,
  } as const;

  return (
    <>
      <View style={{ gap: 4 }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('manager.gym.location.lat')}
        </AppText>
        <TextInput
          value={lat}
          onChangeText={onLatChange}
          placeholder="45.4642"
          accessibilityLabel={t('manager.gym.location.lat')}
          placeholderTextColor={theme.textMuted}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('manager.gym.location.lng')}
        </AppText>
        <TextInput
          value={lng}
          onChangeText={onLngChange}
          placeholder="9.1900"
          accessibilityLabel={t('manager.gym.location.lng')}
          placeholderTextColor={theme.textMuted}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="caption" style={{ fontWeight: '600' }}>
          {t('manager.gym.location.radius')}
        </AppText>
        <TextInput
          value={radiusM}
          onChangeText={onRadiusChange}
          placeholder="150"
          accessibilityLabel={t('manager.gym.location.radius')}
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </View>
    </>
  );
}

/** Shared validation: both callers reject the same way before calling their own RPC. */
export function parseGeofenceFields(lat: string, lng: string, radiusM: string): { lat: number; lng: number; radiusM: number } | null {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const radiusNum = Number(radiusM);
  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) return null;
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) return null;
  if (!Number.isFinite(radiusNum) || radiusNum <= 0) return null;
  return { lat: latNum, lng: lngNum, radiusM: radiusNum };
}

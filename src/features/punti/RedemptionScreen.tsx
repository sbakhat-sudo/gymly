import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { z } from 'zod';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChevronLeftIcon } from '@/components/icons';
import { QrCode } from '@/components/QrCode';
import { Screen } from '@/components/Screen';
import { formatShortDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/services-context';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { Redemption } from '@/schemas';

/** Route params come from outside the app (deep links): validate before use. */
const RedemptionIdSchema = z.string().regex(/^rd_[0-9a-f]{12}$/);

function qrGlow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 30px 80px -20px ${color}` } as ViewStyle,
    android: { elevation: 12 },
    default: { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 40, shadowOffset: { width: 0, height: 30 } },
  });
}

/**
 * Full-screen redemption: a large QR (generated locally) for the reception to scan, plus the
 * 6-character code to read out or type by hand. Only a PENDING code is shown as scannable;
 * validated and expired codes show a plain note instead.
 */
export function RedemptionScreen({ id }: { id: string | string[] | undefined }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const parsed = RedemptionIdSchema.safeParse(id);
  const validId = parsed.success ? parsed.data : null;
  const list = useAsync(() => api.getRedemptions(), [api, validId], validId !== null);
  const redemption = list.data?.redemptions.find((r) => r.id === validId);
  const qrSize = Math.min(width - spacing.lg * 2 - 22 * 2 - spacing.xl * 2, 236);

  const close = <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} style={{ minHeight: 56, marginTop: spacing.sm }} />;

  const header = (status: Redemption['status'] | null) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, backgroundColor: theme.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
      </Pressable>
      {status ? <StatusPill status={status} /> : null}
    </View>
  );

  if (validId === null || (list.data !== undefined && !redemption) || list.error) {
    return (
      <Screen>
        {header(null)}
        <AppText variant="headline" accessibilityRole="header">
          {t('redemption.title')}
        </AppText>
        <Banner title={t('redemption.notFound')} />
        {close}
      </Screen>
    );
  }
  if (!redemption) {
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel={t('state.loading')} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }

  const pending = redemption.status === 'pending';
  const spokenCode = redemption.code.split('').join(' ');

  return (
    <Screen orb={pending ? { color: theme.accent, top: 100, size: 420 } : undefined}>
      {header(redemption.status)}

      <View style={{ gap: 6 }}>
        <AppText muted style={{ fontSize: 13, fontWeight: '600' }}>
          {t('redemption.title')}
        </AppText>
        <AppText variant="headline" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 30 }}>
          {redemption.reward_title}
        </AppText>
      </View>

      {pending ? (
        <>
          <View style={[{ alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: radius.xxl, padding: 22, marginVertical: spacing.xs }, qrGlow(theme.accent)]}>
            <QrCode value={redemption.qr} size={qrSize} accessibilityLabel={t('redemption.qrA11y', { code: spokenCode })} />
          </View>

          <View style={{ alignItems: 'center', gap: 6 }}>
            <AppText muted style={{ fontSize: 12, fontWeight: '600', letterSpacing: 12 * 0.08, textTransform: 'uppercase' }}>
              {t('redemption.code')}
            </AppText>
            <View accessible accessibilityLabel={`${t('redemption.code')}: ${spokenCode}`} style={{ flexDirection: 'row', gap: 6 }}>
              {redemption.code.split('').map((ch, i) => (
                <View
                  key={i}
                  style={{
                    width: 44,
                    height: 54,
                    borderRadius: 14,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <AppText maxFontSizeMultiplier={1.2} style={{ fontFamily: fontFamily.mono, fontSize: 26, lineHeight: 32 }}>
                    {ch}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <AppText muted style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            {t('redemption.instructions')}
          </AppText>
          <AppText color={theme.faint} style={{ fontSize: 12, textAlign: 'center', marginTop: -8 }}>
            {t('redemption.expires', { date: formatShortDate(lang, redemption.expires_at) })}
          </AppText>
        </>
      ) : (
        <Banner message={t(redemption.status === 'expired' ? 'redemption.expiredNote' : 'redemption.validatedNote')} />
      )}

      {close}
    </Screen>
  );
}

/** Status as a tinted pill, always with its text label. */
function StatusPill({ status }: { status: Redemption['status'] }) {
  const { t } = useI18n();
  const theme = useTheme();
  const colors =
    status === 'pending'
      ? { bg: theme.band.amber.soft, fg: theme.band.amber.onSoft }
      : status === 'validated'
        ? { bg: theme.band.green.soft, fg: theme.band.green.onSoft }
        : { bg: theme.surfaceAlt, fg: theme.text };
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.bg }}>
      <AppText color={colors.fg} style={{ fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
        {t(`redemption.status.${status}`)}
      </AppText>
    </View>
  );
}

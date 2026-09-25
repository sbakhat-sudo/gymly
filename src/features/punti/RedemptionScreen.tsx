import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, View, useWindowDimensions } from 'react-native';
import { z } from 'zod';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { QrCode } from '@/components/QrCode';
import { Screen } from '@/components/Screen';
import { formatShortDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/services-context';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

/** Route params come from outside the app (deep links): validate before use. */
const RedemptionIdSchema = z.string().regex(/^rd_[0-9a-f]{12}$/);

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

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
  const qrSize = Math.min(width - spacing.lg * 2 - spacing.xl * 2, 320);

  const close = <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />;

  if (validId === null || (list.data !== undefined && !redemption) || list.error) {
    return (
      <Screen>
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

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('redemption.title')}
        </AppText>
        <AppText variant="title">{redemption.reward_title}</AppText>
        <AppText muted>{t(`redemption.status.${redemption.status}`)}</AppText>
      </View>

      {redemption.status === 'pending' ? (
        <>
          <View
            style={{
              alignSelf: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: radius.lg,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <QrCode value={redemption.qr} size={qrSize} accessibilityLabel={t('redemption.qrA11y', { code: redemption.code.split('').join(' ') })} />
          </View>

          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <AppText muted style={{ fontWeight: '600' }}>
              {t('redemption.code')}
            </AppText>
            <AppText
              accessibilityLabel={`${t('redemption.code')}: ${redemption.code.split('').join(' ')}`}
              style={{ fontFamily: MONO, fontSize: 40, fontWeight: '700', letterSpacing: 8, lineHeight: 48 }}>
              {redemption.code}
            </AppText>
          </View>

          <AppText muted style={{ textAlign: 'center' }}>
            {t('redemption.instructions')}
          </AppText>
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
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

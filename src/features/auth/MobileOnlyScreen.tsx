import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { SignOutButton } from '@/components/SignOutButton';
import { useAppState } from '@/lib/app-state';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

const AUTO_DISMISS_MS = 5_000;

/**
 * The Client role (and the guest preview) is phone-only: meant to be checked in-gym on Expo Go, not
 * from a browser. A Client/guest that lands here from the web build sees this instead of `(client)`
 * — see the `Platform.OS` check in `src/app/_layout.tsx`. Manager/Coach/Admin are unaffected: they
 * keep working from a browser (see `WebOnlyScreen`, their native-side mirror of this screen).
 *
 * Auto-dismisses itself after a few seconds (same action as the button below: sign out if a real
 * account landed here, exit guest mode otherwise) — someone who opened this by mistake on a
 * shared/public browser shouldn't be left staring at a dead-end screen waiting to notice a button.
 */
export function MobileOnlyScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const { guest, setGuest } = useAppState();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (auth.status === 'active') {
        void auth.signOut();
      } else if (guest) {
        setGuest(false);
      }
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl * 2, alignItems: 'center', gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogoMark size={44} bgColor={theme.background} />
          <Wordmark size={28} />
        </View>
        <AppText variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('mobileOnly.title')}
        </AppText>
        <AppText muted style={{ textAlign: 'center', fontSize: 15, lineHeight: 21, maxWidth: 300 }}>
          {t('mobileOnly.body')}
        </AppText>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: spacing.xxl }}>
        {auth.status === 'active' ? (
          <SignOutButton />
        ) : guest ? (
          <Pressable
            onPress={() => setGuest(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={{
              height: MIN_TAP - 8,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: theme.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppText style={{ fontSize: 13, fontWeight: '700' }}>{t('common.back')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

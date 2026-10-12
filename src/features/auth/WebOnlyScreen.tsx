import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { SignOutButton } from '@/components/SignOutButton';
import { useI18n } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';

/**
 * Manager, Coach and Admin are all staff-facing, dashboard-style roles: meant to be used from a
 * browser on a computer/tablet, not the member's phone app. One of these accounts that signs in
 * from a native build (Expo Go on a phone) lands here instead of its own route group — see the
 * `Platform.OS` check in `src/app/_layout.tsx`. The Client role is unaffected: it keeps working
 * everywhere.
 */
export function WebOnlyScreen() {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: spacing.xxl * 2, alignItems: 'center', gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogoMark size={44} bgColor={theme.background} />
          <Wordmark size={28} />
        </View>
        <AppText variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('webOnly.title')}
        </AppText>
        <AppText muted style={{ textAlign: 'center', fontSize: 15, lineHeight: 21, maxWidth: 300 }}>
          {t('webOnly.body')}
        </AppText>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: spacing.xxl }}>
        <SignOutButton />
      </View>
    </Screen>
  );
}

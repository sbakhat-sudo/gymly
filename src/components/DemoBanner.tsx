import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/lib/app-state';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { XIcon } from './icons';

/** Shown over every Client screen while `demo` is on ("Prova la demo" on Benvenuto, web only) — a
 * permanent reminder that this is a marketing preview, with a one-tap way out to the real signup
 * or back to Benvenuto. Rendered once at the root (`_layout.tsx`), not per-screen. */
export function DemoBanner() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setGuest, setDemo } = useAppState();

  function exitDemo(): void {
    setDemo(false);
    setGuest(false);
    router.replace('/(auth)/welcome');
  }

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, zIndex: 50 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          backgroundColor: theme.text,
          borderRadius: radius.pill,
          paddingVertical: 8,
          paddingHorizontal: 8,
          paddingLeft: 16,
        }}>
        <AppText color={theme.background} numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', flexShrink: 1 }}>
          {t('clientDemo.banner.label')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => router.push('/(auth)/signup')} accessibilityRole="button" hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
            <AppText color={theme.primary} style={{ fontSize: 13, fontWeight: '800' }}>
              {t('clientDemo.banner.signup')}
            </AppText>
          </Pressable>
          <Pressable
            onPress={exitDemo}
            accessibilityRole="button"
            accessibilityLabel={t('clientDemo.banner.exit')}
            hitSlop={6}
            style={{ width: MIN_TAP - 12, height: MIN_TAP - 12, alignItems: 'center', justifyContent: 'center' }}>
            <XIcon color={theme.background} size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

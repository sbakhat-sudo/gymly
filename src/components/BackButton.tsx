import { useRouter, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { MIN_TAP, useTheme } from '@/lib/theme';

import { ChevronLeftIcon } from './icons';

/**
 * Back arrow for a screen pushed outside its own tab group (Admin's Parametri/Comunicazioni/
 * Pagamento, reached from Impostazioni) — deliberately `router.replace(href)`, not `router.back()`:
 * these pages are also opened directly by URL (dev testing, an F5 refresh), where there's no
 * navigation history to pop, so `back()` could leave the user stranded or bounce them out of the
 * app. `replace` always lands on a known screen, and never touches the session either way (no
 * sign-out happens here, whichever path was used to get here).
 */
export function BackButton({ href }: { href: Href }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace(href)}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
      <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

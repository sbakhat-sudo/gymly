import { Pressable } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, useTheme } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { AppText } from './AppText';
import { LogOutIcon } from './icons';

/**
 * A quick, always-visible sign-out button for the top of every Impostazioni screen — switching
 * between the Manager/Coach/Client test accounts in the same browser needs a sign-out first (a
 * persisted session otherwise just resumes on reload, never showing the login screen again), and
 * that button was previously only reachable after scrolling down into the Account card.
 * Hidden once the sidebar nav is showing (Manager/Coach/Admin on a wide window): the sidebar has
 * its own sign-out entry, and stacking this on top of it just duplicated the control on screen.
 * Signs out immediately on tap — no confirmation step, for any role.
 */
export function SignOutButton() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const isSidebar = useSidebarMode();

  if (auth.status !== 'active' || isSidebar) return null;

  return (
    <Pressable
      onPress={() => void auth.signOut()}
      accessibilityRole="button"
      accessibilityLabel={t('account.signOut')}
      style={{
        height: MIN_TAP - 8,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: theme.band.red.soft,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}>
      <LogOutIcon color={theme.band.red.onSoft} size={15} strokeWidth={2.2} />
      <AppText color={theme.band.red.onSoft} style={{ fontSize: 13, fontWeight: '700' }}>
        {t('account.signOut')}
      </AppText>
    </Pressable>
  );
}

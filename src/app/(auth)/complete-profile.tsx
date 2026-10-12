import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { CreateGymScreen } from '@/features/manager/CreateGymScreen';
import { RoleAndSiteForm, submitRoleAndSite } from '@/features/auth/RoleAndSiteForm';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { spacing, useTheme } from '@/lib/theme';

/**
 * Reached right after a fresh signup (or first login after email confirmation): the auth account
 * exists but has no site yet. Two different situations share this route (see `auth.role` on the
 * `noProfile` state):
 * - `role === null`: no profile row at all — a brand new Coach/Client signup. If the choice made on
 *   the signup screen is still stored locally (the common case — it just couldn't be applied before
 *   confirmation), it's replayed automatically. Only an interrupted signup resumed on a different
 *   device falls back to asking again via `RoleAndSiteForm`.
 * - `role === 'manager'`: an Admin-approved Manager with no gym yet — their first real task inside
 *   the app. Straight to `CreateGymScreen`, no replay needed (their profile already exists).
 */
export default function CompleteProfileScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const auth = useAuth();
  const [replaying, setReplaying] = useState(true);
  const [replayError, setReplayError] = useState<string | null>(null);
  const noProfileRole = auth.status === 'noProfile' ? auth.role : undefined;

  useEffect(() => {
    if (auth.status !== 'noProfile' || auth.role !== null) return;
    let alive = true;
    void Promise.all([storage.get('pendingRegistration'), storage.get('pendingManagerPlan')]).then(async ([pending, pendingPlan]) => {
      if (!alive) return;
      if (pendingPlan) {
        const { error } = await supabase.rpc('request_manager_signup', { p_plan: pendingPlan.plan, p_full_name: pendingPlan.fullName || null });
        if (!alive) return;
        if (error) {
          setReplayError(error.message);
          setReplaying(false);
          return;
        }
        await storage.remove('pendingManagerPlan');
        await auth.refreshProfile();
        return;
      }
      if (!pending) {
        setReplaying(false);
        return;
      }
      const err = await submitRoleAndSite(pending);
      if (!alive) return;
      if (err) {
        setReplayError(err);
        setReplaying(false);
        return;
      }
      await storage.remove('pendingRegistration');
      await auth.refreshProfile();
    });
    return () => {
      alive = false;
    };
    // `auth.refreshProfile`/`signOut` are stable for the component's lifetime; re-running this on
    // every `auth` identity change would re-replay a choice that's already been cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, noProfileRole]);

  if (auth.status !== 'noProfile') return null;

  if (auth.role === 'manager') {
    return <CreateGymScreen onDone={() => void auth.refreshProfile()} />;
  }

  if (replaying) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('auth.signup.title')}
        </AppText>
        {replayError ? (
          <AppText color={theme.danger} style={{ fontWeight: '600' }}>
            {replayError}
          </AppText>
        ) : null}
        <RoleAndSiteForm onDone={() => void auth.refreshProfile()} />
      </View>
    </Screen>
  );
}

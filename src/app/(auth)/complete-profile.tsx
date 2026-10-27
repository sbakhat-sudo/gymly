import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { ChevronLeftIcon } from '@/components/icons';
import { CreateGymScreen } from '@/features/manager/CreateGymScreen';
import { RoleAndSiteForm, submitRoleAndSite } from '@/features/auth/RoleAndSiteForm';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { MIN_TAP, spacing, useTheme } from '@/lib/theme';

/**
 * Reached right after a fresh signup (or first login after email confirmation): the auth account
 * exists but has no site yet. Two different situations share this route (see `auth.role` on the
 * `noProfile` state):
 * - `role === null`: no profile row at all — a brand new Coach/Client signup. If the choice made on
 *   the signup screen is still stored locally (the common case — it just couldn't be applied before
 *   confirmation), it's replayed automatically. Only an interrupted signup resumed on a different
 *   device falls back to asking again via `RoleAndSiteForm`.
 * - `role === 'manager'`: an Admin-approved Manager with no gym yet — their first real task inside
 *   the app. Straight to `CreateGymScreen`, no replay needed (their profile already exists). (Manager
 *   no longer self-registers — this branch now only serves whatever old pending Managers already
 *   exist from before that changed; see `OwnerSignupScreen.tsx`'s own docstring.)
 *
 * There used to be a third branch here, `role === 'owner'`: an Admin-approved Owner with no business
 * yet, sent to a one-time "name your business" screen (`CreateChainScreen.tsx`). Removed — Admin's own
 * approval (`admin_set_profile_status()`) now creates that `gym_chains` row itself, with a default
 * name, the same moment it activates the profile, so an approved Owner always already has a
 * `chainId` and resolves straight to `status: 'owner'` (see `auth-context.tsx#resolve`) without ever
 * passing through here. Renaming the default name lives in Impostazioni (`owner_rename_chain()`), not
 * as a blocking first step.
 */
/** This route is only reached with a real Supabase session already open (`noProfile`), so a plain
 * `router.back()`/navigate-to-welcome would just get bounced straight back here by the root layout's
 * Stack.Protected guards — the only real way out is to actually sign out, which drops `auth.status`
 * to `signedOut` and unlocks Welcome/Login/Signup again. Labelled (not just an icon) and
 * high-contrast, same convention as the signup/login back buttons. */
function SignOutBackButton({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 6,
        minHeight: MIN_TAP,
        paddingHorizontal: spacing.md,
        borderRadius: MIN_TAP / 2,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1.5,
        borderColor: theme.border,
      }}>
      <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
      <AppText style={{ fontWeight: '700', fontSize: 15 }}>{label}</AppText>
    </Pressable>
  );
}

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
    void Promise.all([storage.get('pendingRegistration'), storage.get('pendingManagerPlan'), storage.get('pendingOwnerPlan')]).then(async ([pending, pendingPlan, pendingOwnerPlan]) => {
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
      if (pendingOwnerPlan) {
        const { error } = await supabase.rpc('request_owner_signup', {
          p_plan: pendingOwnerPlan.plan,
          p_full_name: pendingOwnerPlan.fullName || null,
          p_phone: pendingOwnerPlan.phone || null,
          p_gym_name: pendingOwnerPlan.gymName || null,
        });
        if (!alive) return;
        if (error) {
          setReplayError(error.message);
          setReplaying(false);
          return;
        }
        await storage.remove('pendingOwnerPlan');
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
    return <CreateGymScreen onDone={() => void auth.refreshProfile()} onBack={() => void auth.signOut()} />;
  }

  // Should never happen — admin_set_profile_status() creates the gym_chains row in the same call
  // that approves the Owner, so `role === 'owner'` here means something upstream of this screen
  // failed (an old account from before that change, a migration that didn't reach this row, …). The
  // `replaying` effect above only ever handles `role === null`, so falling into that branch for
  // 'owner' would spin the loading indicator forever with no way out — this is the safety net.
  if (auth.role === 'owner') {
    return (
      <Screen>
        <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
          <SignOutBackButton onPress={() => void auth.signOut()} label={t('common.back')} />
          <AppText variant="display" style={{ fontSize: 28 }}>
            {t('auth.completeProfile.ownerNoChain.title')}
          </AppText>
          <AppText muted>{t('auth.completeProfile.ownerNoChain.body')}</AppText>
        </View>
      </Screen>
    );
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
        <SignOutBackButton onPress={() => void auth.signOut()} label={t('common.back')} />

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

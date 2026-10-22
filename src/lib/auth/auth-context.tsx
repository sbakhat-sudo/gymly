import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase/client';

export type UserRole = 'manager' | 'coach' | 'client' | 'admin' | 'owner';
type ProfileStatus = 'pending' | 'active' | 'rejected';

interface Profile {
  role: UserRole;
  siteId: string | null;
  /** Set once an approved Owner creates their gym_chains row (create_owner_chain()) — same role for
   * Owner that siteId already plays for Manager: "hasn't created their own business yet" is this
   * being null, not a separate status. */
  chainId: string | null;
  status: ProfileStatus;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  birthYear: number | null;
  avatarUrl: string | null;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Session exists but there's no site yet. Two different situations share this: a brand new
   * signup with no profile row at all (`role: null`, mid-signup) and an Admin-approved Manager who
   * hasn't created their gym yet (`role: 'manager'`, profile row exists) — `complete-profile.tsx`
   * tells them apart by `role`. */
  | { status: 'noProfile'; session: Session; role: UserRole | null }
  | { status: 'pending'; session: Session; profile: Profile }
  | { status: 'rejected'; session: Session; profile: Profile }
  | { status: 'active'; session: Session; profile: Profile & { siteId: string } }
  /** Admin is platform-wide, not scoped to any one gym — never has a siteId. */
  | { status: 'admin'; session: Session; profile: Profile }
  /** Owner oversees several Manager-run sites it created itself (a gym-chain business), scoped to
   * its own `gym_chains` row — never a single `siteId` either, same shape as admin. */
  | { status: 'owner'; session: Session; profile: Profile };

type AuthValue = AuthState & {
  refreshProfile(): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, site_id, chain_id, status, full_name, first_name, last_name, birth_year, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  // 'unclaimed' is the placeholder row the auth.users trigger creates immediately at signup, before
  // role/site are chosen — not a real role. Treated exactly like "no row at all" so every existing
  // noProfile/pending/active code path downstream is unchanged.
  if (!data || data.role === 'unclaimed') return null;
  return {
    role: data.role,
    siteId: data.site_id,
    chainId: data.chain_id,
    status: data.status,
    fullName: data.full_name,
    firstName: data.first_name,
    lastName: data.last_name,
    birthYear: data.birth_year,
    avatarUrl: data.avatar_url,
  };
}

async function resolve(session: Session | null): Promise<AuthState> {
  if (!session) return { status: 'signedOut' };
  const profile = await fetchProfile(session.user.id);
  if (!profile) return { status: 'noProfile', session, role: null };
  if (profile.role === 'admin') {
    // A deactivated admin account is blocked exactly like any other rejected profile. Admin is never
    // self-signed-up (always created by hand), so it never has a real 'pending' state to worry about.
    return profile.status === 'active' ? { status: 'admin', session, profile } : { status: 'rejected', session, profile };
  }
  // Owner now follows the exact same pending/rejected/"hasn't created their own thing yet" shape
  // Manager already had (self-signup -> Admin approval -> create their own business) — it must fall
  // through to the generic checks below, not short-circuit on status !== 'active' like Admin does.
  if (profile.status === 'pending') return { status: 'pending', session, profile };
  if (profile.status === 'rejected') return { status: 'rejected', session, profile };
  if (profile.role === 'owner') {
    if (!profile.chainId) return { status: 'noProfile', session, role: profile.role };
    return { status: 'owner', session, profile };
  }
  if (!profile.siteId) return { status: 'noProfile', session, role: profile.role };
  return { status: 'active', session, profile: { ...profile, siteId: profile.siteId } };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    // Always resume the saved session, dev included — a refresh (very common while testing the
    // web build) must land back in the same section, not bounce to the landing page every time.
    // Switching test accounts just needs the explicit sign-out button now, same as a real build.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        void resolve(data.session).then((next) => alive && setState(next));
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session).then((next) => alive && setState(next));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    setState(await resolve(data.session));
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return <AuthContext.Provider value={{ ...state, refreshProfile, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

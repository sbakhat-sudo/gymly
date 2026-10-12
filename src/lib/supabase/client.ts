import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

/**
 * The single Supabase client for the whole app — the one real network boundary
 * (see eslint.config.js). AsyncStorage as the auth storage adapter keeps session
 * persistence working in Expo Go (no SecureStore/native module required).
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * A fresh, isolated client with no persisted session — used only to sign up a brand-new Coach/Client
 * on a Manager's behalf (manager-invite flow) without disturbing the Manager's own `supabase` session.
 * Discard the returned client right after use; nothing it does ever touches device storage.
 */
export function createThrowawayClient() {
  // Narrowed by the guard above, which runs at module load before this is ever called.
  return createClient<Database>(url as string, anonKey as string, {
    // A unique storageKey silences Supabase's "Multiple GoTrueClient instances" warning (harmless
    // but noisy) — persistSession is still false, nothing is actually written to any storage.
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, storageKey: 'gymly-throwaway' },
  });
}

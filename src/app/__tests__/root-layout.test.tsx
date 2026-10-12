/**
 * True end-to-end smoke test of the real routing tree: `renderRouter` loads the actual files
 * under `src/app` (the real `_layout.tsx`, `(auth)/_layout.tsx`, `(auth)/landing.tsx`, …), not a
 * hand-built provider stack like `features/__tests__/screens.test.tsx` does.
 *
 * It exists because a provider missing from the REAL root layout (e.g. `SafeAreaProvider`, which
 * every screen needs via `useSafeAreaInsets()`) is invisible to tests that build their own tree —
 * those pass while the actual app shows nothing but the generic error screen on every platform.
 * (`AppProviders`, src/lib/app-providers.tsx, is now the single source shared by both, which closes
 * this gap structurally; this test is the belt-and-braces check on the real file tree itself.)
 *
 * No Supabase session exists in the test environment (AsyncStorage is empty, and `getSession()`
 * reads local storage only — no network call), so `useAuth()` resolves to `'signedOut'` and the
 * real `Stack.Protected` role gate in `_layout.tsx` lands on the Benvenuto screen — the one real,
 * role-agnostic entry point every fresh install reaches, so it is what this smoke test verifies.
 *
 * `renderRouter` requires every route file under `src/app`, cold, from disk on every call — expect
 * several real seconds, not milliseconds. Keep this file to a single test: two heavy `renderRouter`
 * calls in one worker have been observed to interfere (overlapping `act()` warnings, flaky timing).
 */
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  getRandomBytes: (n: number) => new Uint8Array(n),
}));

it(
  'boots to the Benvenuto screen for a signed-out visitor, with the error screen never showing',
  async () => {
    renderRouter('src/app', { initialUrl: '/' });

    // Real content from the real Benvenuto (Welcome) screen — proves every provider in the real tree is wired.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accedi' })).toBeTruthy(), { timeout: 15_000, interval: 200 });

    // The generic ErrorBoundary fallback (see components/ErrorBoundary.tsx) must never be showing.
    expect(screen.queryByText('Qualcosa non ha funzionato')).toBeNull();

    // This test environment reports a native Platform.OS, so Benvenuto's Manager/plans pitch is
    // correctly hidden here (Bug 17: it must never reach a phone) — its native-only replacement
    // text is the equally-deep real content that proves the tree rendered, on this platform.
    expect(screen.getByText('Sei un gestore di una palestra? Registrati da un computer per iniziare.')).toBeTruthy();
  },
  20_000
);

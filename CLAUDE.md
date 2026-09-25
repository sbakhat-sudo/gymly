@AGENTS.md

# Gymly — member app demo

Demo of the **Gymly member app** (a gym-occupancy app for members) built from the technical spec
"Gymly v3 — Specifica Tecnica (IT)" (§1, §4.4–4.7, §7, §9, §11). It runs entirely on **local mock data**:
no backend, no database, no network. It is written to production standards so the mock can later be
replaced by the real API **without touching the UI**.

Members see only a **band** (Libera / Moderata / Affollata), never a number of people.

## Non-negotiable constraints

1. **Always runs in Expo Go.** SDK is pinned (`expo` in package.json + `sdkVersion` in app.json). No custom native
   modules, no development build. Adding any dependency with native code is a blocking design review.
   Allowed: expo-router, expo-crypto, expo-notifications (**local notifications only**), react-native-svg,
   @react-native-async-storage/async-storage, expo-splash-screen/status-bar/system-ui/constants/linking.
   Remote push does not work in Expo Go and is out of scope.
2. **Zero permissions at first launch**: no location, notifications, camera, account, sign-up or onboarding carousel.
   Flow: open → pick gym → see band. The notification permission is asked only from the 2nd session and only after the
   member has seen a band (`sessionCount`, `valueSeen`).
3. **UI text in Italian (primary) and English**, via `src/lib/i18n` (`en.ts` is typed against `it.ts`).
4. **Never a people count** in the UI, the API types or the cache. Object schemas strip unknown keys.
5. **Never colour alone**: every band has a text label and a distinct shape. Dark mode, dynamic type (capped by
   `MAX_FONT_SCALE`), touch targets ≥ 44pt (`MIN_TAP`).
6. **Never lie about the number**: low confidence → band hidden, forecast shown; unavailable/too old → "Dato non
   disponibile"; stale cached data is shown only dimmed and explicitly labelled (see `domain/home-state.ts`).

## Security rules

- No secrets, keys or tokens in code or repo; no `.env` with real values (`.gitignore` covers env files, keys, certs).
- No network: no `fetch`/XHR/WebSocket/axios, no analytics/trackers/3rd-party SDKs, no WebView, no `eval`/`new Function`,
  no external links without validation. ESLint enforces the bans (`eslint.config.js`).
- Dependencies minimal and **pinned exactly everywhere** (no `^`/`~`, including Expo-managed packages — a
  deliberate deviation from Expo's own convention, per this project's requirements). Add/upgrade Expo packages
  with `npx expo install <pkg>` (which resolves an SDK-compatible `~` range), then strip the range to the exact
  resolved version in package.json. Run `npm audit` and report; never `npm audit fix --force`.
- TypeScript strict (+ `noUncheckedIndexedAccess`), no `any`, no `@ts-ignore` (`@ts-expect-error` needs a description).
- All data, mock included, passes through Zod schemas (`src/schemas`) mirroring spec §6.2; a validation failure surfaces as
  `ApiError('invalid_payload')` and the UI shows "Dato non disponibile".
- UI depends only on the `GymlyApi` interface (`src/lib/api/types.ts`). Mocks are imported only by
  `src/lib/api/mock-api.ts`, `src/lib/services.ts` (composition root) and tests — ESLint fails otherwise.
- AsyncStorage only through `src/lib/storage.ts` (typed keys, validated on write and on read). Non-sensitive preferences
  only. A future member token belongs in expo-secure-store.
- No logging of user data: use `src/lib/logger.ts` (no-op in production, never receives payloads/codes/messages).
- "Cancella i miei dati" really wipes AsyncStorage and returns to the first-launch state, with explicit confirmation.
- Redemption codes come from `expo-crypto` (CSPRNG, injected), single-use, expire after 14 days — never deterministic.
- Global `ErrorBoundary` with non-technical messages.

## Structure

```
src/
  app/            expo-router routes only ((tabs): index = Home, orari, punti, impostazioni)
  components/     shared UI primitives (AppText, Screen, icons, ErrorBoundary, …)
  features/       home, orari, punti, impostazioni (screen logic and components)
  lib/
    api/          GymlyApi interface, ApiError, validation, MockApi, demo controls
    domain/       pure, unit-tested logic: band, confidence, home-state, green-window, suggestion, point-rules, alerts, time
    i18n/         it.ts (source of keys), en.ts, provider
    theme/        design tokens (palettes, spacing, type), contrast helper
    storage.ts, clock.ts, logger.ts, app-state.tsx, services.ts, services-context.tsx
  mocks/          fictional sites, daily curve, rewards, point rules (only the mock API imports these)
  schemas/        Zod schemas = API contracts (spec §6.2 + provisional ones marked as such)
```

## Conventions worth knowing

- **Weekday index: 0 = Monday … 6 = Sunday** everywhere (spec only says 0..6). `weekday_mask` bit i = weekday i.
- Time of day is `HH:MM`; `24:00` is allowed only as an exclusive end (closing). Timestamps are RFC 3339 UTC; site-local
  conversion uses `site.timezone` (`domain/time.ts`).
- Band names follow the API/DB: `green | amber | red`.
- Contracts not defined by the spec body (sites, points, rewards, redemptions, arrival history) are **provisional** and
  flagged in `src/schemas`.
- Points are held at redemption creation and refunded on expiry (spec §9.3 is ambiguous about when they are debited).
- Point rules are ordered, first match wins; the peak rule (0 points) comes first.
- The mock "server" state (ledger, redemptions) lives in memory and resets on restart.
- Expo Router: tabs come from `expo-router/js-tabs` (the `expo-router` export is deprecated in SDK 57).

## Commands

```bash
npx expo start            # dev server → scan the QR with Expo Go
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint
npm test                  # jest (jest-expo)
npx expo-doctor           # dependency/config diagnostics (must pass 21/21)
npm audit                 # report only; do not run `npm audit fix --force`
npx expo export --platform android --output-dir <tmp>   # proves the bundle builds (imports resolve)
```

Before declaring work done: typecheck, lint, tests and expo-doctor must pass.

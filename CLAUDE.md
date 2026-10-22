@AGENTS.md

# Gymly — member app demo

Demo of the **Gymly member app** (a gym-occupancy app for members) built from the technical spec
"Gymly v3 — Specifica Tecnica (IT)" (§1, §4.4–4.7, §7, §9, §11). It runs entirely on **local mock data**:
no backend, no database, no network. It is written to production standards so the mock can later be
replaced by the real API **without touching the UI**.

Members see only a **band** (Libera / Moderata / Affollata), never a number of people.

## Non-negotiable constraints

1. **Expo Go by default; a real Client on the phone needs the EAS development build instead.** SDK is pinned
   (`expo` in package.json + `sdkVersion` in app.json). Adding any dependency with native code beyond what's
   already below is a blocking design review.
   Allowed: expo-router, expo-crypto, expo-notifications (**local notifications only**), react-native-svg,
   @react-native-async-storage/async-storage, expo-splash-screen/status-bar/system-ui/constants/linking,
   expo-location (geofenced check-in + the real background "sei vicino alla palestra" proximity alert below),
   expo-task-manager + expo-dev-client (background geofencing — see below), expo-image-picker (profile photo,
   every role), @supabase/supabase-js (the one real backend — see below).
   Remote push does not work in Expo Go (or this dev build) and is out of scope.
   - **Deliberate, explicit exception to "Expo Go only"**: a real (approved) Client on the phone needs true
     background location to get the "sei vicino alla palestra, fai il check-in" proximity notification while
     the app is closed — Expo Go genuinely cannot run `expo-task-manager`'s background task in that case (no
     amount of JS fixes a missing native module). Confirmed explicitly with the user as a product decision,
     not a silent scope-creep: this one feature requires the EAS `development` build profile (`eas.json`), not
     Expo Go. The implementation (`src/tasks/geofenceTask.ts`, `src/hooks/useSyncGeofences.ts`) checks
     `Constants.appOwnership === 'expo'` (exported as `isExpoGo`) and no-ops the geofencing calls there — the
     rest of the app, and every other role, still runs fine in plain Expo Go; only this one alert is degraded
     (silently absent, never a crash) when not in the dev build. `app.json`'s `expo-location` plugin config +
     iOS `UIBackgroundModes`/Android background-location permissions are already wired for it.
2. **Permissions are asked only when the feature that needs them is actually used** — not at first launch. Location
   is asked at check-in; the photo library is asked when a user taps "cambia foto" in Impostazioni; notifications
   follow the original 2nd-session/`valueSeen` rule below.
   - This project has since grown a real multi-role backend (Supabase: Manager/Coach/Client/Admin accounts, real
     check-ins, a `profiles` table) — point 4 below ("never a people count") and point 6 ("never lie about the
     number") still hold for anything a **member** sees, but Manager-facing screens (e.g. the roster's presence
     list) are allowed to show real names/counts, since that's the Manager's own gym, not member-facing telemetry.
   The notification permission specifically is asked only from the 2nd session and only after the
   member has seen a band (`sessionCount`, `valueSeen`).
3. **UI text in Italian (primary) and English**, via `src/lib/i18n` (`en.ts` is typed against `it.ts`).
4. **Never a people count** in the UI, the API types or the cache. Object schemas strip unknown keys.
   - Deliberate, explicit exception: the real Client's own "Storico" screen (`RealClientScheduleScreen.tsx`)
     shows a real occupancy **percentage** (check-ins ÷ the gym's own `capacity_reference`, which the
     Manager sets in "Gestione Capienza") — confirmed explicitly as a product decision, not an oversight.
     It is always the real, live-computed number for that specific gym, never a static/example value, and
     never a raw headcount (a percentage, not "N persone"). This does not relax the rule for anything
     else — a member still never sees a people count anywhere outside this one screen.
5. **Never colour alone**: every band has a text label and a distinct shape. Dark mode, dynamic type (capped by
   `MAX_FONT_SCALE`), touch targets ≥ 44pt (`MIN_TAP`).
6. **Never lie about the number**: low confidence → band hidden, forecast shown; unavailable/too old → "Dato non
   disponibile"; stale cached data is shown only dimmed and explicitly labelled (see `domain/home-state.ts`).

## Security rules

- No secrets, keys or tokens in code or repo; no `.env` with real values (`.gitignore` covers env files, keys, certs).
- No network outside `src/lib/supabase/**` (and `src/lib/api/supabase-*.ts`/`src/lib/auth/**`, which are built on
  it) — that's the one real backend (Supabase: Postgres + Auth + Storage), everything else still talks only to it
  or to local mocks, never directly to `fetch`/XHR/WebSocket/axios. No analytics/trackers/3rd-party SDKs, no
  WebView, no `eval`/`new Function`, no external links without validation. ESLint enforces the boundary
  (`eslint.config.js`, `no-restricted-globals`), which only catches `fetch`/XHR/WebSocket calls from this app's
  own JS — not a raw `<iframe src>` HTML tag, since the browser (not this app's code) loads that directly.
  - **Deliberate, explicit exception**: the Manager's own "Posizione palestra" card
    (`src/features/manager/ManagerPositionCard.tsx`) embeds a real Google Maps view (a plain `<iframe>`, web
    only — Manager never runs natively) centred on the gym's own coordinates, confirmed explicitly with the
    user as a product decision. It's the Manager's own, already-public business address, never a member's or
    client's location, and the embed is a static URL with no API key, no JS SDK, no tracking script loaded into
    this app. Everything else in this constraint (no fetch/XHR/WebSocket, no analytics/trackers, no 3rd-party
    SDKs) still holds everywhere else in the app, including every other Manager/Coach/Admin screen.
  - **Deliberate, explicit exception**: the Owner's "Aggiungi Manager" flow
    (`supabase/functions/owner-create-manager/index.ts`) is this project's first Supabase Edge
    Function — the one place that creates an Auth account on behalf of someone else, which genuinely
    needs the privileged service-role client (`auth.admin.createUser`). That privileged client is
    obtained through `withSupabase` (`npm:@supabase/server`), keyed off Supabase's own
    platform-managed key — no secret is read from `Deno.env`/hand-configured, and it never leaves
    this one server-side function. The RN app only ever calls
    `supabase.functions.invoke('owner-create-manager', …)` with the signed-in Owner's own session;
    the function re-checks the caller is an active `owner` before doing anything privileged, and the
    actual `profiles`/`sites` insert happens through `owner_create_manager_record()` (a normal
    `SECURITY DEFINER` RPC, called with the Owner's own JWT, not the admin client) — the same
    is_owner()-gated pattern as every other `owner_*`/`admin_*` RPC, not a new access-control model.
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
  app/            expo-router routes only ((tabs): index = Live, checkin, orari, punti, impostazioni)
  components/     shared UI primitives (AppText, Screen, icons, ErrorBoundary, …)
  features/       home (Live), checkin, orari, punti, impostazioni (screen logic and components)
  lib/
    api/          GymlyApi interface, ApiError, validation, MockApi, demo controls
    domain/       pure, unit-tested logic: band, confidence, home-state, green-window, suggestion, checkin, point-rules, alerts, time
    i18n/         it.ts (source of keys), en.ts, provider
    theme/        design tokens (palettes, spacing, type), contrast helper
    storage.ts, clock.ts, logger.ts, app-state.tsx, services.ts, services-context.tsx, notifications.ts
  mocks/          fictional sites, daily curve, rewards, point rules (only the mock API imports these)
  schemas/        Zod schemas = API contracts (spec §6.2 + provisional ones marked as such)
```

### Check-in tab (member-initiated presence, not part of the spec body)

- `GymlyApi.checkIn`/`checkOut` nudge the mock's live ratio by one attendance unit (`mock-api.ts`,
  `CHECKIN_RATIO_BUMP`) — same as everything else, **never exposed as a count**; only the band moves.
- Check-in state is local-only for the guest/mock flow (`storage.ts` key `checkin`), and its 90-min "sei
  ancora qui?" / 15-min auto-checkout phases are derived purely from timestamps
  (`domain/checkin.ts#resolveCheckinPhase`), never from a running background timer — consistent with
  constraint 1. The two local, actionable notifications (`notifications.ts#scheduleCheckinReminders`)
  are a best-effort nudge on top of that, not the source of truth.
  - **A real (authenticated) Client is different and explicitly, deliberately NOT auto-checked-out,
    ever** — a confirmed product decision, not an oversight: a forgotten check-in just keeps nagging
    (see below) instead of silently closing itself, even after hours. `use-real-checkin.ts` caps
    `resolveCheckinPhase`'s result at `'awaitingConfirmation'`, and the server-side `close_stale_checkins`
    cron job that used to auto-close stale client check-ins after 105 minutes has been unscheduled
    entirely (`20261024000000_remove_client_auto_checkout.sql`). Instead of the mock flow's one-off
    90min+105min notification pair, a real Client gets a bounded series of "sei ancora qui?" reminders
    every 10 minutes from the 90-minute mark for up to 2 more hours
    (`notifications.ts#scheduleRepeatingStillHereReminders`) — capped, not infinite, to stay well under
    iOS's ~64 pending-local-notification limit; check-out is always the Client's own manual action. The
    Manager's live occupancy still doesn't lie forever despite this: `get_live_band`/`get_weekly_stats`
    already exclude any check-in open longer than 12 hours from the live count (a display-only filter,
    never a write) regardless of whether the row itself ever gets manually closed.
  - The same "sei ancora qui?" content/style also surfaces in-app the moment the Client opens the app —
    `RealClientCheckInScreen.tsx`'s `ConfirmDialog` renders automatically whenever `phase ===
    'awaitingConfirmation'`, and `ClientNotifications.tsx` (a bell on the Live tab, same pattern as
    `ManagerNotifications.tsx`) surfaces the same pending prompt as a tappable item that jumps straight
    to the Check-in tab.
- The spec's "sei vicino alla palestra" proximity reminder uses real background geofencing
  (`src/tasks/geofenceTask.ts` + `src/hooks/useSyncGeofences.ts`, `expo-location` + `expo-task-manager`)
  for a real Client in the EAS development build — see constraint 1's exception above. In plain Expo Go
  (and for the guest/mock flow, which has no real location to watch) it stays a Demo-panel-only trigger
  (`notifications.ts#sendProximityReminder`).

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
- Decorative icons use `src/lib/a11y.ts`'s `decorativeA11yProps`, never `accessibilityElementsHidden`/
  `importantForAccessibility` directly. Those two React Native props have no DOM equivalent, and
  `react-native-svg`'s web renderer spreads unknown props straight onto the DOM node — passing them
  produced a real "React does not recognize the `X` prop" console error on web in production. Note:
  `npm test` cannot catch this class of bug (jest-expo's renderer isn't a real browser, and
  `react-native-svg` ships no separate web build for Jest to resolve even under `jest-expo/web` — this
  was tried and removed). Check the actual browser console (`npx expo start`, press `w`) when touching
  anything under `src/components` that renders `react-native-svg` elements.
- React Compiler is enabled (see `npx expo export` output) and this project's ESLint config enforces its
  stricter `react-hooks` rules: a ref's `.current` may only be read or written inside an effect/handler,
  never during render (so a mutable `Animated.Value` lives in `useState(() => new Animated.Value(0))`,
  not `useRef(...).current`), and an effect that calls something which eventually calls `setState`
  needs `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment explaining why the
  rule can't see through it (see `use-occupancy.ts` and `checkin/use-checkin.ts` for the pattern).

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

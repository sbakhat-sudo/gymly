/**
 * Platform-wide "this screen shows placeholder data, not a real system" flag — unrelated to the
 * member app's own `guest`/"Guarda l'affluenza senza account" concept (that one lets someone preview
 * the app without an account; this one marks screens like `AdminPagamentoScreen` whose numbers are
 * made up because no real payment gateway is wired up yet).
 *
 * Defaults to on (today's behaviour) so nothing changes until a real deployment explicitly sets
 * `EXPO_PUBLIC_DEMO_MODE=false` — e.g. in that build's `.env` or EAS secret.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

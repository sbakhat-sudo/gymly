/**
 * The only module allowed to touch `console` (see eslint.config.js).
 *
 * Privacy rule: nothing user-related is ever logged. Callers pass a short event name and, at most,
 * primitive metadata. Payloads, redemption codes, ids and error *messages* (which may embed data)
 * are never accepted. In production builds every method is a no-op.
 */
type SafeMeta = Record<string, string | number | boolean>;

const enabled = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  debug(event: string, meta?: SafeMeta): void {
    if (enabled) console.debug(`[gymly] ${event}`, meta ?? '');
  },
  warn(event: string, meta?: SafeMeta): void {
    if (enabled) console.warn(`[gymly] ${event}`, meta ?? '');
  },
  /** Logs only the error's class name/code, never its message or stack. */
  error(event: string, error?: unknown): void {
    if (!enabled) return;
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`[gymly] ${event}`, name);
  },
};

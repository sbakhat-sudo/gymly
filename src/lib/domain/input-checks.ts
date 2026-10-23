/**
 * Cheap sanity checks for free-text fields. They exist because a browser's saved-credentials autofill (and
 * plain typos) can drop an email address into a name or phone field — and the app then saved it as if it
 * were one. These don't try to be a full validator: they only refuse what is clearly the wrong kind of value.
 */

/** A person's name: letters (any language, with accents), spaces, apostrophes, hyphens and dots — never an email, never digits. */
export function isPlausibleName(raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0 || value.length > 80) return false;
  return /^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(value);
}

/** A phone number: digits with an optional leading + and the usual separators, 6–15 digits in all. */
export function isPlausiblePhone(raw: string): boolean {
  const value = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15;
}

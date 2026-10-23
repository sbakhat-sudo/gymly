/** Youngest and oldest age the profile form accepts. The database re-checks the same bounds. */
export const MIN_AGE_YEARS = 16;
export const MAX_AGE_YEARS = 110;

/**
 * Turns whatever is being typed into the "GG/MM/AAAA" shape as the person types: digits only,
 * capped at eight, with the slashes inserted for them — so nobody has to type (or get wrong) the
 * separators.
 */
export function formatBirthInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * "GG/MM/AAAA" -> an ISO date ("AAAA-MM-GG"), or null when it isn't a real calendar date or the person
 * would be younger than `MIN_AGE_YEARS` / older than `MAX_AGE_YEARS` on `today`. ISO dates compare
 * correctly as plain strings, so no time zone ever enters into a birthday.
 */
export function parseBirthDate(input: string, today: Date = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  // Round-trip through Date to reject 31/02, 29/02 in a non-leap year, month 13, and so on.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  const value = iso(year, month, day);
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  if (value > iso(y - MIN_AGE_YEARS, m, d)) return null;
  if (value < iso(y - MAX_AGE_YEARS, m, d)) return null;
  return value;
}

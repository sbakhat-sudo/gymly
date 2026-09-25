import { REDEMPTION_CODE_ALPHABET } from '@/schemas';

export const REDEMPTION_CODE_LENGTH = 6;
export const REDEMPTION_EXPIRY_DAYS = 14;

export type RandomBytes = (length: number) => Uint8Array;

/**
 * Random, single-use redemption code. The randomness source is injected: the app passes
 * `expo-crypto`'s CSPRNG, tests pass a fake. The alphabet has exactly 32 symbols, so `byte & 31` is
 * uniform (256 is a multiple of 32): no modulo bias. Never derive a code from a counter, time or id.
 */
export function generateRedemptionCode(randomBytes: RandomBytes): string {
  if (REDEMPTION_CODE_ALPHABET.length !== 32) throw new Error('alphabet must have 32 symbols');
  const bytes = randomBytes(REDEMPTION_CODE_LENGTH);
  if (bytes.length !== REDEMPTION_CODE_LENGTH) throw new Error('unexpected random length');
  let code = '';
  for (const b of bytes) code += REDEMPTION_CODE_ALPHABET.charAt(b & 31);
  return code;
}

/** Payload encoded in the on-screen QR; the reception scans it (or types the 6-character code). */
export const redemptionQrPayload = (code: string): string => `GYMLY:R:${code}`;

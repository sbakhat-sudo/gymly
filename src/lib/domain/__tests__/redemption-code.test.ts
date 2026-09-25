import { REDEMPTION_CODE_ALPHABET, RedemptionCodeSchema } from '@/schemas';

import { generateRedemptionCode, redemptionQrPayload } from '../redemption-code';

/** Test-only PRNG (mulberry32). Production uses expo-crypto's CSPRNG, injected by `services.ts`. */
function fakeRandom(seed: number): (n: number) => Uint8Array {
  let a = seed;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      out[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
    }
    return out;
  };
}

describe('generateRedemptionCode', () => {
  it('maps bytes through a 32-symbol alphabet (byte & 31): deterministic for known input', () => {
    // 0→A, 1→B, 2→C, 31→9, 32→A (wraps), 255→9
    expect(generateRedemptionCode(() => Uint8Array.from([0, 1, 2, 31, 32, 255]))).toBe('ABC9A9');
  });

  it('alphabet has 32 unambiguous symbols (no I, O, 0, 1)', () => {
    expect(REDEMPTION_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(REDEMPTION_CODE_ALPHABET).size).toBe(32);
    expect(REDEMPTION_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it('always produces a 6-character code accepted by the schema', () => {
    const rnd = fakeRandom(1);
    for (let i = 0; i < 500; i++) {
      expect(RedemptionCodeSchema.safeParse(generateRedemptionCode(rnd)).success).toBe(true);
    }
  });

  it('is not predictable from the call count: consecutive codes differ, 1000 codes are nearly all distinct', () => {
    const rnd = fakeRandom(42);
    const codes = new Set(Array.from({ length: 1000 }, () => generateRedemptionCode(rnd)));
    expect(codes.size).toBeGreaterThan(995); // 32^6 ≈ 1.07e9 combinations
  });

  it('uses every symbol of the alphabet over enough draws (no dead symbols)', () => {
    const rnd = fakeRandom(7);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) for (const c of generateRedemptionCode(rnd)) seen.add(c);
    expect(seen.size).toBe(32);
  });

  it('refuses a randomness source that returns the wrong length', () => {
    expect(() => generateRedemptionCode(() => new Uint8Array(3))).toThrow();
  });
});

describe('redemptionQrPayload', () => {
  it('wraps the code in the payload the desk scanner expects', () => {
    expect(redemptionQrPayload('ABC234')).toBe('GYMLY:R:ABC234');
  });
});

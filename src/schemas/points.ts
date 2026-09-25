import { z } from 'zod';

import { BucketSchema, EndTimeOfDaySchema, Rfc3339UtcSchema, SiteIdSchema, TimeOfDaySchema, WeekdaySchema } from './common';

/**
 * PROVISIONAL CONTRACTS — the spec lists `/v1/me/points`, `/v1/me/rewards`, `/v1/me/redemptions`
 * (§6.2) but not their response bodies. Shapes derive from the tables in §5 (point_rules,
 * points_ledger, rewards, redemptions).
 */

/** `weekday_mask`: bit i set = weekday i (0 = Monday). 127 = every day. */
export const PointRuleSchema = z.object({
  id: z.string().min(1).max(40),
  weekday_mask: z.number().int().min(0).max(127),
  from_time: TimeOfDaySchema,
  /** Exclusive. `24:00` means "until closing". */
  to_time: EndTimeOfDaySchema,
  points: z.number().int().min(0).max(1000),
  daily_cap: z.number().int().min(1).max(10),
});
export type PointRule = z.infer<typeof PointRuleSchema>;

export const LedgerReasonSchema = z.enum(['offpeak_visit', 'redemption', 'redemption_refund', 'adjustment']);
export type LedgerReason = z.infer<typeof LedgerReasonSchema>;

/** Append-only movement (spec §5 `points_ledger`). */
export const LedgerEntrySchema = z.object({
  id: z.number().int().positive(),
  delta: z.number().int().min(-100000).max(100000),
  reason: LedgerReasonSchema,
  ref_id: z.string().max(40).optional(),
  created_at: Rfc3339UtcSchema,
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const PointsSchema = z.object({
  site_id: SiteIdSchema,
  balance: z.number().int().min(0).max(1000000),
  /** Most recent first. */
  ledger: z.array(LedgerEntrySchema).max(200),
  /** Ordered: the first matching rule wins (spec §9.2). */
  rules: z.array(PointRuleSchema).max(20),
});
export type Points = z.infer<typeof PointsSchema>;

export const RewardSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  cost: z.number().int().positive().max(100000),
  /** null = unlimited. */
  stock: z.number().int().min(0).nullable(),
});
export type Reward = z.infer<typeof RewardSchema>;

export const RewardsSchema = z.object({
  site_id: SiteIdSchema,
  rewards: z.array(RewardSchema).max(50),
});
export type Rewards = z.infer<typeof RewardsSchema>;

/** Unambiguous alphabet: no I/O/0/1 (typing a code by hand at the desk must not be error-prone). */
export const REDEMPTION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RedemptionCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);

export const RedemptionSchema = z.object({
  id: z.string().min(1).max(40),
  reward_id: z.string().min(1).max(40),
  reward_title: z.string().min(1).max(80),
  /** 6-character code, typeable by hand at the desk (spec §9.3 offline fallback). */
  code: RedemptionCodeSchema,
  /** Opaque payload encoded into the on-screen QR. */
  qr: z.string().min(1).max(64),
  status: z.enum(['pending', 'validated', 'expired']),
  created_at: Rfc3339UtcSchema,
  /** created_at + 14 days (spec §9.3). */
  expires_at: Rfc3339UtcSchema,
});
export type Redemption = z.infer<typeof RedemptionSchema>;

export const RedemptionsSchema = z.object({ redemptions: z.array(RedemptionSchema).max(100) });
export type Redemptions = z.infer<typeof RedemptionsSchema>;

/** Card-link code typed by the member (demo: any well-formed fictional code). */
export const LinkCodeSchema = z.string().regex(/^[A-Z0-9]{6,12}$/);

export const MeSchema = z.discriminatedUnion('linked', [
  z.object({ linked: z.literal(false) }),
  z.object({ linked: z.literal(true), site_id: SiteIdSchema }),
]);
export type Me = z.infer<typeof MeSchema>;

/** The member's own arrival history (weekday + 15-min bucket), last 60 days. Provisional contract. */
export const ArrivalHistorySchema = z.object({
  arrivals: z.array(z.object({ weekday: WeekdaySchema, bucket: BucketSchema })).max(500),
});
export type ArrivalHistory = z.infer<typeof ArrivalHistorySchema>;

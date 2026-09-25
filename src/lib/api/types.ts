import type {
  ArrivalHistory,
  Forecast,
  Me,
  Occupancy,
  Points,
  Redemption,
  Redemptions,
  Rewards,
  SiteSummary,
  Weekday,
} from '@/schemas';

/**
 * The single boundary between the UI and "the backend". The UI only ever imports this interface
 * (never the mocks). Going live = writing an `HttpApi` that implements it and swapping it in
 * `src/lib/services.ts`; screens don't change. All results are already validated (Zod).
 *
 * Every method may reject with an `ApiError`.
 */
export interface GymlyApi {
  /** GET /v1/public/sites (the "near me" query is not used: the demo never asks for location). */
  getSites(): Promise<SiteSummary[]>;
  /** GET /v1/public/sites/{id}/occupancy — band + confidence, never a people count. */
  getOccupancy(siteId: string): Promise<Occupancy>;
  /** GET /v1/public/sites/{id}/forecast?weekday=N — weekday 0 = Monday … 6 = Sunday. */
  getForecast(siteId: string, weekday: Weekday): Promise<Forecast>;

  /** Who am I linked as? (demo stand-in for the opaque device/member token) */
  getMe(): Promise<Me>;
  /** Link the membership card with a code (demo: any well-formed fictional code). */
  linkMember(siteId: string, code: string): Promise<Me>;
  unlinkMember(): Promise<void>;
  /** In-app "Cancella i miei dati": ask the service to erase everything it holds about this device. */
  requestDataDeletion(): Promise<void>;

  /** GET /v1/me/points → 409 capability_unavailable on sites without named access control. */
  getPoints(): Promise<Points>;
  /** GET /v1/me/rewards */
  getRewards(): Promise<Rewards>;
  /** The member's own recent arrivals, for the personal suggestion (provisional endpoint). */
  getArrivalHistory(): Promise<ArrivalHistory>;
  /** POST /v1/me/redemptions — `idempotencyKey` makes a retry safe (spec §6.4). */
  createRedemption(rewardId: string, idempotencyKey: string): Promise<Redemption>;
  getRedemptions(): Promise<Redemptions>;
}

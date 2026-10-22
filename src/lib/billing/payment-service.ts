import * as Crypto from 'expo-crypto';

export interface ChargeInput {
  planType: 'monthly' | 'annual';
}

export interface ChargeResult {
  success: true;
  reference: string;
}

/**
 * Mock payment behind the same shape a real gateway call would have ({planType} in,
 * {success, reference} out) — nothing here touches money, there is no payment processor in this
 * project (see CLAUDE.md's pinned-dependency rule, and AdminPagamentoScreen.tsx's own mocked billing
 * UI for the same reasoning). Swapping this for a real gateway (Stripe, etc.) later only ever means
 * replacing the body of `charge`, never anything that calls it — `PlanChoiceModal`/`PaymentDueBanner`
 * depend on this interface, not on how the charge actually happens, same principle as `GymlyApi`.
 */
export const PaymentService = {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    void input;
    return { success: true, reference: Crypto.randomUUID() };
  },
};

import type { TranslationKey } from '@/lib/i18n';

import type { PlanCardTier } from './billing-api';

/** Fixed per tier, independent of whichever colour the Manager picked for the card itself — VIP and
 * VVIP are meant to read as the same two colours everywhere they appear (Manager's "Le mie carte",
 * the Client's plan-choice popup, "Il tuo abbonamento" on Storico). 'normal' has none: no badge
 * renders for it anywhere (see every call site's own `tier !== 'normal'` guard). */
export const TIER_BADGE_COLOR: Record<PlanCardTier, string> = { normal: '', vip: '#F97316', vvip: '#3B82F6' };

export const TIER_LABEL_KEY: Record<PlanCardTier, TranslationKey> = {
  normal: 'manager.subscriptions.cards.tier.normal',
  vip: 'manager.subscriptions.cards.tier.vip',
  vvip: 'manager.subscriptions.cards.tier.vvip',
};

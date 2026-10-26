import { supabase } from '@/lib/supabase/client';

export type SubscriptionStatus = 'active' | 'grace' | 'blocked';
export type PlanCardTier = 'normal' | 'vip' | 'vvip';

export interface PlanCard {
  id: string;
  name: string;
  /** Null for an Owner-made card: those carry only a name and monthly/annual. */
  priceEur: number | null;
  durationDays: number;
  /** Set for a card the Owner made — a Manager sees and assigns it but can never edit it. */
  ownerCardId: string | null;
  /** What the plan includes, the Manager's own words — null until they write one. */
  description: string | null;
  /** Hex the Manager picked for this card — null means "use the deterministic auto-tint instead",
   * see `avatarTint`. */
  color: string | null;
  /** Purely a visual/organizational badge, independent of price/duration/colour. */
  tier: PlanCardTier;
  active: boolean;
}

export interface MySubscription {
  planName: string;
  priceEur: number | null;
  planDescription: string | null;
  planTier: PlanCardTier | null;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  lastPaymentDate: string;
  graceEndDate: string | null;
  warningSentAt: string | null;
}

export interface MySubscriptionState {
  needsPlanChoice: boolean;
  subscription: MySubscription | null;
}

export async function getMySubscription(): Promise<MySubscriptionState> {
  const { data, error } = await supabase.rpc('client_get_my_subscription');
  if (error) throw error;
  return data as MySubscriptionState;
}

/** This Client's own gym's still-offered plan cards — shown on the mandatory first-login choice and
 * on "cambia piano" later. Read straight through `site_plan_cards`' own RLS policy (scoped to the
 * caller's site and `active` rows only), same pattern as `gym_chains`: a select policy + RPC-only
 * writes, no read RPC needed. */
export async function getAvailablePlanCards(): Promise<PlanCard[]> {
  const { data, error } = await supabase.from('site_plan_cards').select('id, name, price_eur, duration_days, owner_card_id, description, color, tier, active').order('price_eur');
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, priceEur: r.price_eur, durationDays: r.duration_days, ownerCardId: r.owner_card_id, description: r.description, color: r.color, tier: r.tier, active: r.active }));
}

export async function choosePlan(cardId: string): Promise<void> {
  const { error } = await supabase.rpc('client_choose_plan', { p_card_id: cardId });
  if (error) throw error;
}

export async function confirmPaymentDuringGrace(): Promise<void> {
  const { error } = await supabase.rpc('client_confirm_payment_during_grace');
  if (error) throw error;
}

export async function switchPlan(cardId: string): Promise<void> {
  const { error } = await supabase.rpc('client_switch_plan', { p_card_id: cardId });
  if (error) throw error;
}

export interface ClientSubscriptionRow {
  clientId: string;
  fullName: string | null;
  planName: string | null;
  priceEur: number | null;
  /** The plan card's own colour, snapshotted/kept in sync the same way as name/price — null for a
   * legacy row or one whose card never had a colour picked. */
  planColor: string | null;
  status: SubscriptionStatus | null;
  startDate: string | null;
  expiryDate: string | null;
  lastPaymentDate: string | null;
}

export async function getManagerClientSubscriptions(): Promise<ClientSubscriptionRow[]> {
  const { data, error } = await supabase.rpc('manager_get_client_subscriptions');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clientId: r.client_id,
    fullName: r.full_name,
    planName: r.plan_name,
    priceEur: r.price_eur,
    planColor: r.plan_color,
    status: r.status,
    startDate: r.start_date,
    expiryDate: r.expiry_date,
    lastPaymentDate: r.last_payment_date,
  }));
}

export async function assignPlan(clientId: string, cardId: string): Promise<void> {
  const { error } = await supabase.rpc('manager_assign_plan', { p_client_id: clientId, p_card_id: cardId });
  if (error) throw error;
}

/** Manual override, not a real payment event — 'blocked' suspends access immediately regardless of
 * expiry_date, 'active' lifts that suspension. Never 'grace': that status only makes sense alongside
 * the grace_end_date the lifecycle cron computes, not something a manual click should fabricate. */
export async function setSubscriptionStatus(clientId: string, status: 'active' | 'blocked'): Promise<void> {
  const { error } = await supabase.rpc('manager_set_subscription_status', { p_client_id: clientId, p_status: status });
  if (error) throw error;
}

/** Removes the subscription entirely — the client goes back to "no plan" and can be assigned a
 * fresh one, the only way to undo an assignment made by mistake. */
export async function deleteSubscription(clientId: string): Promise<void> {
  const { error } = await supabase.rpc('manager_delete_subscription', { p_client_id: clientId });
  if (error) throw error;
}

/** The Manager's own catalog, active and retired cards alike (so a retired one still shows up, just
 * not toggleable back on by accident from an "assign" sheet — see `ManagerSubscriptionsScreen.tsx`). */
export async function getManagerPlanCards(): Promise<PlanCard[]> {
  const { data, error } = await supabase.from('site_plan_cards').select('id, name, price_eur, duration_days, owner_card_id, description, color, tier, active').order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, priceEur: r.price_eur, durationDays: r.duration_days, ownerCardId: r.owner_card_id, description: r.description, color: r.color, tier: r.tier, active: r.active }));
}

export async function createPlanCard(name: string, priceEur: number, durationDays: number, description: string | null, color: string | null, tier: PlanCardTier): Promise<void> {
  const { error } = await supabase.rpc('manager_create_plan_card', { p_name: name, p_price_eur: priceEur, p_duration_days: durationDays, p_description: description, p_color: color, p_tier: tier });
  if (error) throw error;
}

export async function updatePlanCard(
  cardId: string,
  name: string,
  priceEur: number,
  durationDays: number,
  description: string | null,
  color: string | null,
  tier: PlanCardTier
): Promise<void> {
  const { error } = await supabase.rpc('manager_update_plan_card', {
    p_card_id: cardId,
    p_name: name,
    p_price_eur: priceEur,
    p_duration_days: durationDays,
    p_description: description,
    p_color: color,
    p_tier: tier,
  });
  if (error) throw error;
}

export async function setPlanCardActive(cardId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('manager_set_plan_card_active', { p_card_id: cardId, p_active: active });
  if (error) throw error;
}

/** A real delete, not just deactivation — any subscription still linked to this card is detached
 * (kept, just no longer live-synced) rather than blocked or cascade-deleted. */
export async function deletePlanCard(cardId: string): Promise<void> {
  const { error } = await supabase.rpc('manager_delete_plan_card', { p_card_id: cardId });
  if (error) throw error;
}

/** Whether the Owner lets Managers make their own cards on top of the Owner's — drives whether the
 * Manager screen offers "nuova carta" at all (the database refuses it either way). */
export async function getManagersCanCreateCards(): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_managers_can_create_cards');
  if (error) throw error;
  return data;
}

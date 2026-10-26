import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

/** How many members are on one kind of plan, and what those subscriptions add up to. */
export interface OwnerSubscriptionRow {
  kind: 'monthly' | 'annual';
  tier: 'normal' | 'vip' | 'vvip';
  count: number;
  revenueEur: number;
}

/** Payments recorded in one month for one kind of plan (see the subscription_payments history table). */
export interface OwnerSubscriptionTrendPoint {
  /** First day of the month, ISO date. */
  monthStart: string;
  kind: 'monthly' | 'annual';
  tier: 'normal' | 'vip' | 'vvip';
  subscribers: number;
  revenueEur: number;
}

export interface OwnerOverview {
  managers: number;
  clients: number;
  coaches: number;
  /** What the Owner's members actually pay: the sum of their currently active subscriptions. */
  revenueEur: number;
  /** What the Owner's gyms cost on Gymly's own plans (pro/business) — a different number from the above. */
  planCostEur: number;
  /** Always six rows — Mensile/Annuale x Normale/VIP/VVIP, zeros included. */
  subscriptions: OwnerSubscriptionRow[];
  activity7d: { day: string; count: number }[];
}

export async function getOwnerOverview(): Promise<OwnerOverview> {
  const { data, error } = await supabase.rpc('owner_get_overview');
  if (error) throw error;
  const d = data as OwnerOverview;
  return {
    managers: d.managers,
    clients: d.clients,
    coaches: d.coaches,
    revenueEur: d.revenueEur,
    planCostEur: d.planCostEur ?? 0,
    subscriptions: d.subscriptions ?? [],
    activity7d: d.activity7d,
  };
}

/** Month by month, how many subscriptions were paid or renewed on each of the six kinds of plan — always every
 * month x six types, zeros included, oldest month first. */
export async function getOwnerSubscriptionTrend(months = 6): Promise<OwnerSubscriptionTrendPoint[]> {
  const { data, error } = await supabase.rpc('owner_get_subscription_trend', { p_months: months });
  if (error) throw error;
  return data.map((r) => ({ monthStart: r.month_start, kind: r.kind, tier: r.tier, subscribers: r.subscribers, revenueEur: r.revenue_eur }));
}

/** The Owner's own app-plan payment state — `grace` means the automatic 3-day window is running;
 * `warningSent` flips once the last 24 hours before automatic deactivation begin. */
export interface OwnerPlanBilling {
  plan: 'trial' | 'pro' | 'business';
  status: 'active' | 'grace' | 'deactivated';
  paidUntil: string | null;
  graceEnd: string | null;
  warningSent: boolean;
}

export async function getOwnerPlanBilling(): Promise<OwnerPlanBilling | null> {
  const { data, error } = await supabase.rpc('owner_get_plan_billing');
  if (error) throw error;
  const row = data[0];
  if (!row) return null;
  return {
    plan: row.plan,
    status: row.plan_status,
    paidUntil: row.plan_paid_until,
    graceEnd: row.plan_grace_end,
    warningSent: row.plan_warning_sent_at !== null,
  };
}

export interface OwnerManagerRow {
  managerId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  siteId: string;
  siteName: string;
  address: string | null;
  addressVerified: boolean;
  clientCount: number;
  coachCount: number;
  createdAt: string;
}

export async function getOwnerManagers(): Promise<OwnerManagerRow[]> {
  const { data, error } = await supabase.rpc('owner_get_managers');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    managerId: r.manager_id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    siteId: r.site_id,
    siteName: r.site_name,
    address: r.address,
    addressVerified: r.address_verified,
    clientCount: r.client_count,
    coachCount: r.coach_count,
    createdAt: r.created_at,
  }));
}

export interface OwnerClient {
  id: string;
  fullName: string | null;
  membershipType: 'annual' | 'monthly' | null;
  paymentStatus: 'paid' | 'unpaid' | null;
}

export interface OwnerManagerDetail {
  siteId: string;
  siteName: string;
  address: string | null;
  plan: 'trial' | 'pro' | 'business';
  lat: number | null;
  lng: number | null;
  radius: number;
  clients: OwnerClient[];
  coaches: { id: string; fullName: string | null }[];
  paidCount: number;
  unpaidCount: number;
}

export async function getOwnerManagerDetail(managerId: string): Promise<OwnerManagerDetail> {
  const { data, error } = await supabase.rpc('owner_get_manager_detail', { p_manager_id: managerId });
  if (error) throw error;
  return data as OwnerManagerDetail;
}

export interface AddManagerInput {
  fullName: string;
  email: string;
  siteName: string;
  address: string;
  whatsappPhone: string;
  lat?: number;
  lng?: number;
}

export interface AddManagerResult {
  email: string;
  tempPassword: string;
  managerId: string;
  siteId: string;
}

/** Calls the one Edge Function in this project (`supabase/functions/owner-create-manager`) — the
 * only place a new Auth account is created on behalf of someone else. See CLAUDE.md's "Deliberate,
 * explicit exception" entry for why this needs server-side privileges instead of a plain RPC. */
export async function addManager(input: AddManagerInput): Promise<AddManagerResult> {
  const { data, error } = await supabase.functions.invoke<AddManagerResult>('owner-create-manager', {
    body: { fullName: input.fullName, email: input.email, siteName: input.siteName, address: input.address, phone: input.whatsappPhone, lat: input.lat, lng: input.lng },
  });
  if (error) {
    // A plain `throw error` here only ever surfaces the generic "Edge Function returned a non-2xx
    // status code" — the function's own `{ message }` body (the actually useful part: "not
    // authorized", a duplicate email, etc.) has to be read separately from the error's response.
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : null;
      throw new Error(message ?? error.message);
    }
    throw error;
  }
  if (!data) throw new Error('empty response');
  return data;
}

export interface OwnerHq {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export async function getOwnerHq(): Promise<OwnerHq> {
  const { data, error } = await supabase.rpc('owner_get_hq');
  if (error) throw error;
  return data as OwnerHq;
}

export async function setOwnerHq(address: string, lat?: number, lng?: number): Promise<void> {
  const { error } = await supabase.rpc('owner_set_hq', { p_address: address, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) throw error;
}

export async function getOwnerChainName(): Promise<string | null> {
  const { data, error } = await supabase.rpc('owner_get_chain_name');
  if (error) throw error;
  return data;
}

export async function renameOwnerChain(name: string): Promise<void> {
  const { error } = await supabase.rpc('owner_rename_chain', { p_name: name });
  if (error) throw error;
}

/** One subscription card the Owner made — shared by every Manager in the chain. Just a free-text
 * name, monthly or annual, and the day it was created. */
export interface OwnerPlanCard {
  id: string;
  name: string;
  kind: 'monthly' | 'annual';
  active: boolean;
  createdAt: string;
}

export async function getOwnerPlanCards(): Promise<OwnerPlanCard[]> {
  const { data, error } = await supabase.from('owner_plan_cards').select('id, name, kind, active, created_at').order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, kind: r.kind, active: r.active, createdAt: r.created_at }));
}

export async function createOwnerPlanCard(name: string, kind: 'monthly' | 'annual'): Promise<void> {
  const { error } = await supabase.rpc('owner_create_plan_card', { p_name: name, p_kind: kind });
  if (error) throw error;
}

export async function updateOwnerPlanCard(cardId: string, name: string, kind: 'monthly' | 'annual'): Promise<void> {
  const { error } = await supabase.rpc('owner_update_plan_card', { p_card_id: cardId, p_name: name, p_kind: kind });
  if (error) throw error;
}

export async function setOwnerPlanCardActive(cardId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('owner_set_plan_card_active', { p_card_id: cardId, p_active: active });
  if (error) throw error;
}

export async function deleteOwnerPlanCard(cardId: string): Promise<void> {
  const { error } = await supabase.rpc('owner_delete_plan_card', { p_card_id: cardId });
  if (error) throw error;
}

/** The option: may Managers also create their own subscription cards? Off until the Owner says so. */
export async function setManagersCanCreateCards(allowed: boolean): Promise<void> {
  const { error } = await supabase.rpc('owner_set_managers_can_create_cards', { p_allowed: allowed });
  if (error) throw error;
}

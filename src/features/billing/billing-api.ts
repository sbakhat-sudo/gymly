import { supabase } from '@/lib/supabase/client';

export type PlanType = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'grace' | 'blocked';

export interface MySubscription {
  planType: PlanType;
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

export async function choosePlan(plan: PlanType): Promise<void> {
  const { error } = await supabase.rpc('client_choose_plan', { p_plan: plan });
  if (error) throw error;
}

export async function confirmPaymentDuringGrace(): Promise<void> {
  const { error } = await supabase.rpc('client_confirm_payment_during_grace');
  if (error) throw error;
}

export async function switchPlan(plan: PlanType): Promise<void> {
  const { error } = await supabase.rpc('client_switch_plan', { p_plan: plan });
  if (error) throw error;
}

export interface ClientSubscriptionRow {
  clientId: string;
  fullName: string | null;
  planType: PlanType | null;
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
    planType: r.plan_type,
    status: r.status,
    startDate: r.start_date,
    expiryDate: r.expiry_date,
    lastPaymentDate: r.last_payment_date,
  }));
}

export async function assignPlan(clientId: string, plan: PlanType): Promise<void> {
  const { error } = await supabase.rpc('manager_assign_plan', { p_client_id: clientId, p_plan: plan });
  if (error) throw error;
}

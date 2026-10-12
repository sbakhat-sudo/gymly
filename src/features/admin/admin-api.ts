import { supabase } from '@/lib/supabase/client';

export type SiteApprovalStatus = 'pending_approval' | 'active' | 'suspended';

export interface AdminOverview {
  sitesPending: number;
  sitesActive: number;
  sitesSuspended: number;
  managersTotal: number;
  managersActive: number;
  /** New Managers who picked a plan and are waiting for approval before they can create their gym. */
  managersPending: number;
  checkinsToday: number;
}

export async function getOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_get_overview').single();
  if (error) throw error;
  return {
    sitesPending: data.sites_pending,
    sitesActive: data.sites_active,
    sitesSuspended: data.sites_suspended,
    managersTotal: data.managers_total,
    managersActive: data.managers_active,
    managersPending: data.managers_pending,
    checkinsToday: data.checkins_today,
  };
}

export type SitePlan = 'trial' | 'pro' | 'business';

export interface AdminSite {
  siteId: string;
  name: string;
  address: string | null;
  approvalStatus: SiteApprovalStatus;
  createdAt: string;
  managerId: string;
  managerName: string | null;
  managerStatus: 'pending' | 'active' | 'rejected' | null;
  plan: SitePlan;
}

export { getSiteGeofence, type SiteGeofence } from '@/lib/gym-status';

/** Unlike the Manager's `setSiteLocation`, this works on ANY site — `admin_set_site_location`
 * checks `is_admin()` instead of gym ownership, see the migration. */
export async function adminSetSiteLocation(siteId: string, lat: number, lng: number, radiusM: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_site_location', { p_site_id: siteId, p_lat: lat, p_lng: lng, p_radius: radiusM });
  if (error) throw error;
}

export async function getSites(): Promise<AdminSite[]> {
  const [{ data: sites, error: sitesError }, { data: managers, error: managersError }] = await Promise.all([
    supabase.from('sites').select('site_id, name, address, approval_status, created_at, manager_id, plan').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, status').eq('role', 'manager'),
  ]);
  if (sitesError) throw sitesError;
  if (managersError) throw managersError;
  const managerById = new Map(managers.map((m) => [m.id, m]));
  return sites.map((s) => {
    const manager = managerById.get(s.manager_id);
    return {
      siteId: s.site_id,
      name: s.name,
      address: s.address,
      approvalStatus: s.approval_status,
      createdAt: s.created_at,
      managerId: s.manager_id,
      managerName: manager?.full_name ?? null,
      managerStatus: manager?.status ?? null,
      plan: s.plan,
    };
  });
}

export async function setSitePlan(siteId: string, plan: SitePlan): Promise<void> {
  const { error } = await supabase.rpc('admin_set_site_plan', { p_site_id: siteId, p_plan: plan });
  if (error) throw error;
}

export async function setSiteStatus(siteId: string, status: SiteApprovalStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_site_status', { p_site_id: siteId, p_status: status });
  if (error) throw error;
}

export interface AdminManagerOption {
  userId: string;
  fullName: string | null;
}

/** Active managers only — the only valid targets for `reassignSiteManager`. */
export async function getActiveManagers(): Promise<AdminManagerOption[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'manager').eq('status', 'active').order('full_name', { ascending: true });
  if (error) throw error;
  return data.map((m) => ({ userId: m.id, fullName: m.full_name }));
}

export async function reassignSiteManager(siteId: string, newManagerId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reassign_site_manager', { p_site_id: siteId, p_new_manager_id: newManagerId });
  if (error) throw error;
}

export async function setManagerStatus(userId: string, status: 'active' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_profile_status', { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export interface PendingManager {
  userId: string;
  fullName: string | null;
  requestedPlan: SitePlan | null;
  createdAt: string;
}

/** New Manager signups: a plan was picked, no gym exists yet — waiting for this approval before
 * `create_manager_site` is even callable. */
export async function getPendingManagers(): Promise<PendingManager[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, requested_plan, created_at')
    .eq('role', 'manager')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((m) => ({ userId: m.id, fullName: m.full_name, requestedPlan: m.requested_plan, createdAt: m.created_at }));
}

// ── Dashboard growth chart ──────────────────────────────────────────────

export interface MonthCount {
  monthKey: string;
  count: number;
}

export async function getSitesGrowth(months = 6): Promise<MonthCount[]> {
  const { data, error } = await supabase.rpc('admin_get_sites_growth', { p_months: months });
  if (error) throw error;
  return data.map((r) => ({ monthKey: r.month_key, count: r.count }));
}

// ── Parametri — one real, wired setting ────────────────────────────────────

export interface PlatformSettings {
  defaultCapacityReference: number;
  supportEmail: string | null;
}

export async function getSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from('platform_settings').select('default_capacity_reference, support_email').eq('id', true).single();
  if (error) throw error;
  return { defaultCapacityReference: data.default_capacity_reference, supportEmail: data.support_email };
}

export async function updateSettings(settings: PlatformSettings): Promise<void> {
  const { error } = await supabase.rpc('admin_update_settings', {
    p_default_capacity_reference: settings.defaultCapacityReference,
    p_support_email: settings.supportEmail,
  });
  if (error) throw error;
}

// ── Comunicazioni — Admin → Manager only, in-app (push doesn't work in Expo Go) ───────────────

export interface Broadcast {
  id: number;
  title: string;
  body: string;
  createdAt: string;
}

export async function getBroadcasts(): Promise<Broadcast[]> {
  const { data, error } = await supabase.from('broadcasts').select('id, title, body, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((b) => ({ id: b.id, title: b.title, body: b.body, createdAt: b.created_at }));
}

export async function createBroadcast(title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('admin_create_broadcast', { p_title: title, p_body: body });
  if (error) throw error;
}

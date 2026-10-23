import { supabase } from '@/lib/supabase/client';
import { currentUserAgent } from '@/lib/user-agent';

export type SiteApprovalStatus = 'pending_approval' | 'active' | 'suspended';

export interface AdminOverview {
  sitesPending: number;
  sitesActive: number;
  sitesSuspended: number;
  managersTotal: number;
  managersActive: number;
  /** Legacy pending Managers from before self-registration moved to Owner — almost always 0 now,
   * kept only so any such leftover account still surfaces somewhere. Real pending approvals are
   * `ownersPending` below. */
  managersPending: number;
  /** New Owners who picked a plan and are waiting for approval before their business (gym_chains row,
   * created automatically at approval — see admin_set_profile_status()) exists. */
  ownersPending: number;
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
    ownersPending: data.owners_pending,
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
  chainName: string | null;
}

export { getSiteGeofence, type SiteGeofence } from '@/lib/gym-status';

/** Unlike the Manager's `setSiteLocation`, this works on ANY site — `admin_set_site_location`
 * checks `is_admin()` instead of gym ownership, see the migration. */
export async function adminSetSiteLocation(siteId: string, lat: number, lng: number, radiusM: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_site_location', {
    p_site_id: siteId,
    p_lat: lat,
    p_lng: lng,
    p_radius: radiusM,
    p_user_agent: currentUserAgent(),
  });
  if (error) throw error;
}

export interface GpsAuditEntry {
  id: number;
  siteId: string;
  siteName: string;
  changedByName: string | null;
  changedAt: string;
  oldLat: number | null;
  oldLng: number | null;
  oldRadius: number | null;
  newLat: number;
  newLng: number;
  newRadius: number;
  userAgent: string | null;
}

/** Every GPS geofence change (Manager's own edit or Admin's, any site) — `gps_audit_log`, written
 * atomically inside `manager_set_site_location`/`admin_set_site_location`. `siteId: null` = every site. */
export async function getGpsAuditLog(siteId: string | null = null): Promise<GpsAuditEntry[]> {
  const { data, error } = await supabase.rpc('admin_get_gps_audit_log', { p_site_id: siteId, p_limit: 500 });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    siteName: r.site_name,
    changedByName: r.changed_by_name,
    changedAt: r.changed_at,
    oldLat: r.old_lat,
    oldLng: r.old_lng,
    oldRadius: r.old_radius,
    newLat: r.new_lat,
    newLng: r.new_lng,
    newRadius: r.new_radius,
    userAgent: r.user_agent,
  }));
}

export async function getSites(): Promise<AdminSite[]> {
  const [{ data: sites, error: sitesError }, { data: managers, error: managersError }, { data: chains, error: chainsError }] = await Promise.all([
    supabase.from('sites').select('site_id, name, address, approval_status, created_at, manager_id, plan, chain_id').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, status').eq('role', 'manager'),
    supabase.from('gym_chains').select('id, name'),
  ]);
  if (sitesError) throw sitesError;
  if (managersError) throw managersError;
  if (chainsError) throw chainsError;
  const managerById = new Map(managers.map((m) => [m.id, m]));
  const chainById = new Map(chains.map((c) => [c.id, c.name]));
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
      chainName: s.chain_id ? (chainById.get(s.chain_id) ?? null) : null,
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
 * `create_manager_site` is even callable.
 * @deprecated Manager no longer self-registers (product decision) — this stays only for whatever
 * pending Manager rows already existed before that changed. New requests only ever come from
 * `getPendingOwners()` now. */
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

export async function setOwnerStatus(userId: string, status: 'active' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_profile_status', { p_user_id: userId, p_status: status });
  if (error) throw error;
}

/** New Owner signups: a plan was picked, waiting for this approval — which also creates their
 * `gym_chains` row (`admin_set_profile_status()`). Owner's equivalent of the old `getPendingManagers()`. */
export async function getPendingOwners(): Promise<PendingManager[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, requested_plan, created_at')
    .eq('role', 'owner')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((m) => ({ userId: m.id, fullName: m.full_name, requestedPlan: m.requested_plan, createdAt: m.created_at }));
}

export interface AdminOwnerRow {
  ownerId: string;
  fullName: string | null;
  email: string;
  chainName: string | null;
  plan: SitePlan | null;
  managersCount: number;
  createdAt: string;
}

/** The roster of already-approved Owners (never pending ones — those are `getPendingOwners()`'s own
 * queue) — how many Managers each one's chain actually has, the thing Admin had no visibility into
 * before. */
export async function getOwners(): Promise<AdminOwnerRow[]> {
  const { data, error } = await supabase.rpc('admin_get_owners');
  if (error) throw error;
  return data.map((o) => ({
    ownerId: o.owner_id,
    fullName: o.full_name,
    email: o.email,
    chainName: o.chain_name,
    plan: o.plan,
    managersCount: o.managers_count,
    createdAt: o.created_at,
  }));
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

// ── Admin actions log — Dashboard "Ultime azioni Admin" + its full "Vedi tutto" log ───────────

export type AdminActionType =
  | 'site_approved'
  | 'site_suspended'
  | 'site_status_changed'
  | 'site_plan_changed'
  | 'site_reassigned'
  | 'manager_activated'
  | 'manager_deactivated'
  | 'owner_activated'
  | 'owner_deactivated';

export interface AdminActionEntry {
  id: number;
  adminName: string | null;
  actionType: AdminActionType;
  entityLabel: string | null;
  detail: string | null;
  createdAt: string;
}

/** Every approve/suspend/reassign/activate-deactivate the Admin has done — `admin_actions_log`,
 * written atomically inside each of those RPCs (see the migration). Separate from `getGpsAuditLog`,
 * which covers GPS geofence changes only. */
export async function getActionsLog(limit = 15): Promise<AdminActionEntry[]> {
  const { data, error } = await supabase.rpc('admin_get_actions_log', { p_limit: limit });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    adminName: r.admin_name,
    actionType: r.action_type as AdminActionType,
    entityLabel: r.entity_label,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

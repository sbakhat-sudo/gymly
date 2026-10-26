import { supabase } from '@/lib/supabase/client';

export type ActivityRole = 'owner' | 'manager' | 'coach' | 'client';
/** One of the derived events ('checkin', 'payment', ...) or a logged action shaped `entity:insert|update|delete`. */
export type ActivityEventType = string;

/** One thing someone did, in the words of the database: who, what, when. Never free text from a member. */
export interface ActivityEvent {
  at: string;
  type: ActivityEventType;
  actorId: string;
  actorName: string;
  actorRole: ActivityRole;
  /** A short fact that goes with the event (the plan and price of a payment, a rating out of 5, the fields an edit
   * changed — never their values) — null otherwise. */
  detail: string | null;
}

/** Newest first. What the caller sees depends on their own role — Owner: its Managers, Coaches and Clients;
 * Admin: Owners, Coaches and Clients; Manager: its Clients and Coaches (the database decides, see
 * `get_activity_feed`). `before` is the `at` of the oldest event already shown, to load the next page. */
export async function getActivityFeed(limit: number, before: string | null, role: ActivityRole | null): Promise<ActivityEvent[]> {
  const { data, error } = await supabase.rpc('get_activity_feed', { p_limit: limit, p_before: before, p_role: role });
  if (error) throw error;
  return data.map((r) => ({ at: r.event_at, type: r.event_type, actorId: r.actor_id, actorName: r.actor_name, actorRole: r.actor_role, detail: r.detail }));
}

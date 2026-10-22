import { logger } from './logger';
import { supabase } from './supabase/client';

/** A duplicate `coach_ratings` insert for the same `checkin_id` hits the table's own unique
 * constraint (Postgres `23505`) — the one place "already submitted" is actually enforced, not a
 * client-side guess. */
const UNIQUE_VIOLATION = '23505';

export interface SiteCoach {
  id: string;
  fullName: string | null;
}

/** Active coaches at the caller's own gym — there is no per-session "which coach did I train with"
 * link in `checkins`, so the Client picks one explicitly when rating. */
export async function getMySiteCoaches(): Promise<SiteCoach[]> {
  const { data, error } = await supabase.rpc('get_my_site_coaches');
  if (error) throw error;
  return data.map((r) => ({ id: r.id, fullName: r.full_name }));
}

/** Throws with `code: '23505'` (duck-typed, not `instanceof`: supabase-js's PostgrestError doesn't
 * reliably pass `instanceof Error`) when this check-out was already rated — the screen shows that as
 * "already sent", not a generic error. `clientId` is the caller's own id (same convention as
 * `checkins-api.ts#realCheckIn`): RLS's `with check` requires `client_id = auth.uid()` to match
 * exactly, so this is never trusted blindly — only ever the signed-in user's own id, passed down
 * from `useAuth()` by the screen that calls this. */
export async function submitCoachRating(checkinId: number, clientId: string, coachId: string, rating: number, comment: string | null): Promise<void> {
  const { error } = await supabase.from('coach_ratings').insert({ checkin_id: checkinId, client_id: clientId, coach_id: coachId, rating, comment });
  if (error) throw error;
}

export function isDuplicateRating(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && e.code === UNIQUE_VIOLATION);
}

/** Free text, nothing required — "tutto facoltativo" in the spec covers the description itself too,
 * but an empty report has no value, so the screen itself requires non-empty text before calling this. */
export async function submitIssueReport(checkinId: number, clientId: string, description: string): Promise<void> {
  const { error } = await supabase.from('issue_reports').insert({ checkin_id: checkinId, client_id: clientId, description });
  if (error) throw error;
}

export interface MyRatingEntry {
  id: number;
  checkinId: number;
  createdAt: string;
  coachName: string;
  coachAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  coachReply: string | null;
}

/** The Client's own history — never includes `manager_note` (Manager↔Coach only). The RPC itself
 * doesn't carry `avatar_url` (it's a rating, not a profile row), so this does the same two-step
 * batch join `manager-api.ts#getRatings` uses: the ratings first, then one `profiles` lookup for
 * every distinct coach — `profiles_select_site_coaches` already lets the Client read an active
 * coach's profile at their own site (same policy `get_my_site_coaches()` relies on). */
export async function getMyRatingsHistory(): Promise<MyRatingEntry[]> {
  const { data, error } = await supabase.rpc('client_get_my_ratings');
  if (error) throw error;
  if (data.length === 0) return [];

  // The avatar photo is a nice-to-have on top of the rating data, never a reason to fail the whole
  // history: `coachIds` filters out any row without one (e.g. a pre-migration RPC response that
  // doesn't carry `coach_id` yet — `.in('id', [undefined])` otherwise throws a Postgres `22P02`,
  // live-verified), and a lookup failure degrades to no photo instead of throwing.
  const coachIds = [...new Set(data.map((r) => r.coach_id).filter((id): id is string => Boolean(id)))];
  const avatarByCoachId = new Map<string, string | null>();
  if (coachIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, avatar_url').in('id', coachIds);
    if (profilesError) logger.error('feedback.coach_avatar_lookup_failed', profilesError);
    else for (const p of profiles) avatarByCoachId.set(p.id, p.avatar_url);
  }

  return data.map((r) => ({
    id: r.id,
    checkinId: r.checkin_id,
    createdAt: r.created_at,
    coachName: r.coach_name,
    coachAvatarUrl: avatarByCoachId.get(r.coach_id) ?? null,
    rating: r.rating,
    comment: r.comment,
    coachReply: r.coach_reply,
  }));
}

export interface ResolvedIssueToday {
  id: number;
  description: string | null;
  resolvedAt: string;
}

/** Any issue resolved today at the Client's own gym — on request, site-wide, not only the report the
 * Client themselves filed (the original `client_id = auth.uid()` scoping only showed this to the
 * one reporter) — and, also on request, naming the actual problem. Still not a reply channel — the
 * Manager never writes text the Client reads here: `description` is always the Client's own
 * original report text, never anything the Manager wrote. */
export async function getMyIssuesResolvedToday(): Promise<ResolvedIssueToday[]> {
  const { data, error } = await supabase.rpc('client_get_site_issues_resolved_today');
  if (error) throw error;
  return data.map((r) => ({ id: r.id, description: r.description, resolvedAt: r.resolved_at }));
}

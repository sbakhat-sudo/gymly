import { supabase } from '@/lib/supabase/client';

// ── Feedback module — Coach side: own ratings only (never another coach's, never issue_reports,
// which the Coach has no policy/RPC access to at all). ─────────────────────────────────────────

export interface CoachRatingEntry {
  id: number;
  createdAt: string;
  clientName: string;
  rating: number;
  comment: string | null;
  coachReply: string | null;
  managerNote: string | null;
}

/** `coach_get_my_ratings()` is SECURITY DEFINER scoped to `coach_id = auth.uid()` server-side — a
 * Coach has no RLS path to read another coach's rows even if this were called with different args,
 * since there are no args to tamper with. */
export async function getMyRatings(): Promise<CoachRatingEntry[]> {
  const { data, error } = await supabase.rpc('coach_get_my_ratings');
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    clientName: r.client_name,
    rating: r.rating,
    comment: r.comment,
    coachReply: r.coach_reply,
    managerNote: r.manager_note,
  }));
}

/** Sent straight to the Client, no Manager approval step (spec: "inviata subito... senza
 * approvazione del Manager"). `coach_reply_to_rating()` re-checks ownership server-side regardless. */
export async function replyToRating(ratingId: number, reply: string): Promise<void> {
  const { error } = await supabase.rpc('coach_reply_to_rating', { p_rating_id: ratingId, p_reply: reply });
  if (error) throw error;
}

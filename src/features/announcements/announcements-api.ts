import { supabase } from '@/lib/supabase/client';

export type AnnouncementKind = 'info' | 'warning' | 'closure';

/** A notice from the gym to its members. */
export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  kind: AnnouncementKind;
  /** null = stays until the Manager removes it. */
  expiresAt: string | null;
  createdAt: string;
}

/**
 * The notices the caller's gym has. Row-level security does the scoping: a Client or Coach gets only their own
 * gym's notices that are still running, a Manager gets every notice of their gym — expired ones included, so
 * they can see and remove them (`isExpired` tells them apart).
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from('gym_announcements').select('id, title, body, kind, expires_at, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, body: r.body, kind: r.kind, expiresAt: r.expires_at, createdAt: r.created_at }));
}

export function isExpired(a: Pick<Announcement, 'expiresAt'>, nowMs: number): boolean {
  return a.expiresAt !== null && new Date(a.expiresAt).getTime() <= nowMs;
}

export async function createAnnouncement(input: { title: string; body: string | null; kind: AnnouncementKind; expiresAt: string | null }): Promise<void> {
  const { error } = await supabase.rpc('manager_create_announcement', { p_title: input.title, p_body: input.body, p_kind: input.kind, p_expires_at: input.expiresAt });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.rpc('manager_delete_announcement', { p_id: id });
  if (error) throw error;
}

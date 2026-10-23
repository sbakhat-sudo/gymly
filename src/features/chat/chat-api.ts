import { supabase } from '@/lib/supabase/client';

/** One Owner <-> Manager conversation, as seen by whoever is asking (`otherName` is the other side). */
export interface ChatConversation {
  conversationId: string;
  otherId: string;
  otherName: string | null;
  lastBody: string | null;
  lastAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
}

export const CHAT_MAX_LENGTH = 2000;

/** A Manager's own Owner — the one person they can write to. */
export interface ChatOwner {
  ownerId: string;
  ownerName: string | null;
}

/** The Manager's Owner (whose chain their gym belongs to), or null when there is none. */
export async function getMyOwner(): Promise<ChatOwner | null> {
  const { data, error } = await supabase.rpc('chat_get_my_owner');
  if (error) throw error;
  const row = data[0];
  return row ? { ownerId: row.owner_id, ownerName: row.owner_name } : null;
}

/** Opens (creating it the first time) the conversation with `otherUserId`: an Owner can only reach a
 * Manager running a gym in their own chain and a Manager only their own Owner — the database refuses
 * anything else. */
export async function openConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('chat_open_conversation', { p_other_id: otherUserId });
  if (error) throw error;
  return data;
}

export async function getConversations(): Promise<ChatConversation[]> {
  const { data, error } = await supabase.rpc('chat_get_conversations');
  if (error) throw error;
  return data.map((c) => ({
    conversationId: c.conversation_id,
    otherId: c.other_id,
    otherName: c.other_name,
    lastBody: c.last_body,
    lastAt: c.last_at,
    unreadCount: c.unread_count,
  }));
}

/** The latest messages, oldest first. */
export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('chat_get_messages', { p_conversation_id: conversationId });
  if (error) throw error;
  return data.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('chat_send_message', { p_conversation_id: conversationId, p_body: body });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('chat_mark_read', { p_conversation_id: conversationId });
  if (error) throw error;
}

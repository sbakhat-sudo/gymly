import { supabase } from './client';

const AVATAR_BUCKET = 'avatars';

/**
 * Uploads a locally-picked image (the `file://`/blob URI expo-image-picker returns) to the public
 * `avatars` bucket at a fixed `{userId}/avatar.jpg` path — overwriting any previous photo — then
 * points `profiles.avatar_url` at the new public URL and returns it. Reading the URI via `fetch`
 * here is a local file read, not a network call, but this still has to live inside
 * `src/lib/supabase/` either way (the one place ESLint allows the network globals at all).
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // The path never changes on re-upload, so a cache-busting query param is the only way a device
  // or browser that already cached the old photo picks up the new one.
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
  if (updateError) throw updateError;

  return avatarUrl;
}

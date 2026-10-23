import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { uploadAvatar } from '@/lib/supabase/avatar';

export type PhotoNotice = 'permission' | 'permissionBlocked' | 'error' | null;

/**
 * "Cambia foto" for the signed-in user: asks for the photo library only when the person actually taps the
 * photo (never at launch — and never on web, whose file picker needs no OS-level permission, where asking
 * only produced a false "denied"), uploads it to the avatars bucket, then refreshes the profile so the new
 * picture shows everywhere at once.
 */
export function usePhotoChange(): { change: () => Promise<void>; uploading: boolean; notice: PhotoNotice } {
  const auth = useAuth();
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<PhotoNotice>(null);
  const userId = auth.status !== 'loading' && auth.status !== 'signedOut' ? auth.session.user.id : null;

  async function change(): Promise<void> {
    if (!userId) return;
    setNotice(null);
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice(permission.canAskAgain ? 'permission' : 'permissionBlocked');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      await uploadAvatar(userId, result.assets[0].uri);
      await auth.refreshProfile();
    } catch {
      setNotice('error');
    } finally {
      setUploading(false);
    }
  }

  return { change, uploading, notice };
}

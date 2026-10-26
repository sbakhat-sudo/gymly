import { getOwnerChainName } from '@/features/owner/owner-api';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { getSiteName } from '@/lib/supabase/site-name';
import { useAsync } from '@/lib/use-async';

import { SettingsHero } from './SettingsKit';
import { usePhotoChange } from './use-photo-change';

/**
 * The profile card at the top of every signed-in role's Impostazioni: photo (tap to change), name, role, the
 * gym (the Owner's own business name for an Owner, otherwise the gym they belong to — always shown next to the role,
 * since it says which gym the app is being used for) and the sign-in email.
 * Reads everything from the session, so each role's screen just renders `<ProfileHero />`.
 */
export function ProfileHero() {
  const { t } = useI18n();
  const auth = useAuth();
  const photo = usePhotoChange();

  const profile = auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? auth.profile : null;
  const isOwner = profile?.role === 'owner';
  const siteId = profile && !isOwner && 'siteId' in profile ? profile.siteId : null;
  const chainName = useAsync(() => getOwnerChainName(), [], isOwner);
  const siteName = useAsync(() => (siteId ? getSiteName(siteId) : Promise.resolve(null)), [siteId], siteId !== null);

  if (!profile) return null;
  const email = auth.status === 'active' || auth.status === 'admin' || auth.status === 'owner' ? (auth.session.user.email ?? null) : null;

  return (
    <SettingsHero
      name={profile.fullName}
      roleLabel={t(`settings.role.${profile.role}`)}
      gymName={isOwner ? chainName.data : siteName.data}
      email={email}
      avatarUri={profile.avatarUrl}
      onChangePhoto={() => void photo.change()}
      uploading={photo.uploading}
      notice={photo.notice ? t(photo.notice === 'permission' ? 'account.photo.permission' : photo.notice === 'permissionBlocked' ? 'account.photo.permissionBlocked' : 'account.photo.error') : null}
    />
  );
}

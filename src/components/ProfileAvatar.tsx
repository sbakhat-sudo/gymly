import { useAvatarUrl } from '@/lib/supabase/avatars';

import { Avatar } from './Avatar';

type Props = Omit<React.ComponentProps<typeof Avatar>, 'uri'> & {
  /** Whose photo to show — looked up (batched, cached) so a list does not need to carry photo URLs itself. */
  userId: string | null | undefined;
  /** A photo URL the row already has, used as is instead of a lookup. */
  uri?: string | null;
};

/** `Avatar` that finds the person's real photo by id; the initials show until it is known or when there is none. */
export function ProfileAvatar({ userId, uri, ...rest }: Props) {
  const looked = useAvatarUrl(uri ? null : userId);
  return <Avatar uri={uri ?? looked} {...rest} />;
}

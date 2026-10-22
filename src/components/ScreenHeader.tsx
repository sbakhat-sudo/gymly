import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';

import { usePageHeader } from '@/lib/page-header-context';
import { spacing } from '@/lib/theme';
import { useSidebarMode } from '@/lib/use-sidebar-mode';

import { PageTitle } from './PageTitle';

type IconType = (p: { color: string; size: number }) => ReactElement;

/**
 * A screen's title + (optionally) its notification bell — the replacement for manually combining
 * `<PageTitle>` and e.g. `<ManagerNotifications>` inline. In sidebar mode (wide Manager/Coach/Admin
 * web), it renders nothing here: it only registers this screen's title with `RoleTopBar` (via
 * `usePageHeader`), which shows it fixed above every screen instead, alongside the date badge and
 * bell. On a narrow window or native, where there's no sidebar/top-bar, it renders inline exactly
 * like the old `<PageTitle>` + bell row did.
 */
export function ScreenHeader({ icon, label, notifications }: { icon: IconType; label: string; notifications?: ReactNode }) {
  const isSidebar = useSidebarMode();
  usePageHeader(icon, label);

  if (isSidebar) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <PageTitle icon={icon} label={label} />
      {notifications}
    </View>
  );
}

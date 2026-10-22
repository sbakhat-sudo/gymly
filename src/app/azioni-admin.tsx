import { Redirect } from 'expo-router';

import { AdminActionsLogScreen } from '@/features/admin/AdminActionsLogScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function AzioniAdminRoute() {
  const auth = useAuth();
  if (auth.status !== 'admin') return <Redirect href="/" />;
  return <AdminActionsLogScreen />;
}

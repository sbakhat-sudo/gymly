import { Redirect } from 'expo-router';

import { AdminGpsAuditScreen } from '@/features/admin/AdminGpsAuditScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function AuditGpsRoute() {
  const auth = useAuth();
  if (auth.status !== 'admin') return <Redirect href="/" />;
  return <AdminGpsAuditScreen />;
}

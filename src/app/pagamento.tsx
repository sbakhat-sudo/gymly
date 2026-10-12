import { Redirect } from 'expo-router';

import { AdminPagamentoScreen } from '@/features/admin/AdminPagamentoScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function PagamentoRoute() {
  const auth = useAuth();
  if (auth.status !== 'admin') return <Redirect href="/" />;
  return <AdminPagamentoScreen />;
}

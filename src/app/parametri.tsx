import { Redirect } from 'expo-router';

import { AdminParametriScreen } from '@/features/admin/AdminParametriScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function ParametriRoute() {
  const auth = useAuth();
  if (auth.status !== 'admin') return <Redirect href="/" />;
  return <AdminParametriScreen />;
}

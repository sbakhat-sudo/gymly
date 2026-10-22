import { Redirect } from 'expo-router';

import { ManagerCapacityScreen } from '@/features/manager/ManagerCapacityScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function CapienzaRoute() {
  const auth = useAuth();
  if (auth.status !== 'active' || auth.profile.role !== 'manager') return <Redirect href="/" />;
  return <ManagerCapacityScreen />;
}

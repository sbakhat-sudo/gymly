import { Redirect } from 'expo-router';

import { AdminComunicazioniScreen } from '@/features/admin/AdminComunicazioniScreen';
import { useAuth } from '@/lib/auth/auth-context';

export default function ComunicazioniRoute() {
  const auth = useAuth();
  if (auth.status !== 'admin') return <Redirect href="/" />;
  return <AdminComunicazioniScreen />;
}

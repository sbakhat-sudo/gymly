import { HomeScreen } from '@/features/home/HomeScreen';
import { RealClientLiveScreen } from '@/features/home/RealClientLiveScreen';
import { useAuth } from '@/lib/auth/auth-context';

/** A real, approved Client gets their own real gym; everyone else gets the existing mock flow. */
export default function LiveTab() {
  const auth = useAuth();
  if (auth.status === 'active' && auth.profile.role === 'client') return <RealClientLiveScreen siteId={auth.profile.siteId} />;
  return <HomeScreen />;
}

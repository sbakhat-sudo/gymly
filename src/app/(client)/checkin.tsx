import { CheckInScreen } from '@/features/checkin/CheckInScreen';
import { RealClientCheckInScreen } from '@/features/checkin/RealClientCheckInScreen';
import { useAuth } from '@/lib/auth/auth-context';

/** A real, approved Client gets the real check-in; everyone else gets the existing mock flow. */
export default function CheckinTab() {
  const auth = useAuth();
  if (auth.status === 'active' && auth.profile.role === 'client') return <RealClientCheckInScreen siteId={auth.profile.siteId} />;
  return <CheckInScreen />;
}

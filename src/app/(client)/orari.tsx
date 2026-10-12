import { RealClientScheduleScreen } from '@/features/orari/RealClientScheduleScreen';
import { ScheduleScreen } from '@/features/orari/ScheduleScreen';
import { useAuth } from '@/lib/auth/auth-context';

/** A real, approved Client gets the same week-heatmap design, built from their real gym's own hours. */
export default function OrariTab() {
  const auth = useAuth();
  if (auth.status === 'active' && auth.profile.role === 'client') return <RealClientScheduleScreen siteId={auth.profile.siteId} />;
  return <ScheduleScreen />;
}

import { useLocalSearchParams } from 'expo-router';

import { RedemptionScreen } from '@/features/punti/RedemptionScreen';

export default function RedemptionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RedemptionScreen id={id} />;
}

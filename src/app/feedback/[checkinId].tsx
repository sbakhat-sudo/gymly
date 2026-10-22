import { useLocalSearchParams } from 'expo-router';

import { SubmitFeedbackScreen } from '@/features/feedback/SubmitFeedbackScreen';

export default function FeedbackRoute() {
  const { checkinId, auto } = useLocalSearchParams<{ checkinId: string; auto?: string }>();
  return <SubmitFeedbackScreen checkinId={Number(checkinId)} autoPrompt={auto === '1'} />;
}

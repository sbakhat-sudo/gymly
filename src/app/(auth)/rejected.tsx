import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/lib/theme';

export default function RejectedScreen() {
  const { t } = useI18n();
  const auth = useAuth();
  const isManager = auth.status === 'rejected' && auth.profile.role === 'manager';

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
        <AppText variant="headline">{t(isManager ? 'auth.rejected.manager.title' : 'auth.rejected.title')}</AppText>
        <AppText muted>{t(isManager ? 'auth.rejected.manager.body' : 'auth.rejected.body')}</AppText>
        <Button label={t('account.signOut')} variant="secondary" onPress={() => void auth.signOut()} />
      </View>
    </Screen>
  );
}

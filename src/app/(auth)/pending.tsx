import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/lib/theme';

export default function PendingScreen() {
  const { t } = useI18n();
  const auth = useAuth();
  const [checking, setChecking] = useState(false);
  const isManager = auth.status === 'pending' && auth.profile.role === 'manager';

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.lg }}>
        <AppText variant="headline">{t(isManager ? 'auth.pending.manager.title' : 'auth.pending.title')}</AppText>
        <AppText muted>{t(isManager ? 'auth.pending.manager.body' : 'auth.pending.body')}</AppText>
        <Button
          label={t('auth.pending.refresh')}
          onPress={() => {
            setChecking(true);
            void auth.refreshProfile().finally(() => setChecking(false));
          }}
          disabled={checking}
        />
        <Button label={t('account.signOut')} variant="secondary" onPress={() => void auth.signOut()} />
      </View>
    </Screen>
  );
}

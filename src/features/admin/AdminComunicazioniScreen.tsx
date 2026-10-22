import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { BellIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { createBroadcast, getBroadcasts } from './admin-api';

/**
 * In-app only — real push notifications don't work in Expo Go (Expo's own limitation, not this
 * project's choice). Reaches Manager accounts only, same boundary as the rest of Admin.
 */
export function AdminComunicazioniScreen() {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const broadcasts = useAsync(() => getBroadcasts(), []);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<'sent' | 'error' | 'invalid' | null>(null);

  async function send(): Promise<void> {
    if (title.trim() === '' || body.trim() === '') {
      setFeedback('invalid');
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      await createBroadcast(title, body);
      setTitle('');
      setBody('');
      setFeedback('sent');
      broadcasts.reload();
    } catch {
      setFeedback('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen onRefresh={broadcasts.reload} refreshing={broadcasts.loading && broadcasts.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <BackButton href="/(admin)/impostazioni" />
        <PageTitle icon={BellIcon} label={t('admin.broadcasts.title')} />
        <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
          {t('admin.broadcasts.subtitle')}
        </AppText>
      </View>

      <Card>
        <SectionTitle>{t('admin.broadcasts.new')}</SectionTitle>
        <TextInput
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setFeedback(null);
          }}
          placeholder={t('admin.broadcasts.titlePlaceholder')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('admin.broadcasts.titlePlaceholder')}
          style={{
            minHeight: MIN_TAP,
            borderWidth: 1.5,
            borderColor: feedback === 'invalid' ? theme.danger : theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            color: theme.text,
            fontSize: 15,
          }}
        />
        <TextInput
          value={body}
          onChangeText={(v) => {
            setBody(v);
            setFeedback(null);
          }}
          placeholder={t('admin.broadcasts.bodyPlaceholder')}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t('admin.broadcasts.bodyPlaceholder')}
          multiline
          numberOfLines={4}
          style={{
            minHeight: 90,
            borderWidth: 1.5,
            borderColor: feedback === 'invalid' ? theme.danger : theme.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            color: theme.text,
            fontSize: 15,
            textAlignVertical: 'top',
          }}
        />
        {feedback ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={feedback === 'sent' ? theme.text : theme.danger} style={{ fontWeight: '600' }}>
              {t(feedback === 'sent' ? 'admin.broadcasts.sent' : feedback === 'invalid' ? 'admin.broadcasts.invalid' : 'admin.broadcasts.error')}
            </AppText>
          </View>
        ) : null}
        <Button label={t('admin.broadcasts.send')} onPress={() => void send()} disabled={sending} />
      </Card>

      <SectionTitle>{t('admin.broadcasts.history')}</SectionTitle>
      {broadcasts.error ? <Banner title={t('admin.broadcasts.loadError')} /> : null}
      {broadcasts.data === undefined && broadcasts.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {broadcasts.data && broadcasts.data.length === 0 ? <Banner message={t('admin.broadcasts.empty')} /> : null}
      {broadcasts.data?.map((b) => (
        <Card key={b.id}>
          <AppText style={{ fontWeight: '700' }}>{b.title}</AppText>
          <AppText style={{ fontSize: 14, lineHeight: 20 }}>{b.body}</AppText>
          <AppText variant="caption" muted>
            {new Date(b.createdAt).toLocaleString(lang)}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

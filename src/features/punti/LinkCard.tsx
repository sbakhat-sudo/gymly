import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { useAppState } from '@/lib/app-state';
import { isApiError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/services-context';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { LinkCodeSchema, type SiteSummary } from '@/schemas';

/**
 * Optional card linking. No camera and no permissions: the member types the code printed on the
 * card / given at the desk. In the demo any well-formed fictional code works (e.g. DEMO1234).
 */
export function LinkCard({ site }: { site: SiteSummary }) {
  const { t } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const { setMemberSiteId } = useAppState();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    if (!LinkCodeSchema.safeParse(normalized).success) {
      setProblem('invalid');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api.linkMember(site.site_id, normalized);
      setMemberSiteId(site.site_id);
    } catch (e) {
      setProblem(isApiError(e) && e.code === 'bad_request' ? 'invalid' : 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t('points.link.title')}</SectionTitle>
      <AppText muted>{t('points.link.body')}</AppText>
      <TextInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setProblem(null);
        }}
        placeholder={t('points.link.placeholder')}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={t('points.link.placeholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={16}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        style={{
          minHeight: MIN_TAP + 4,
          borderWidth: 1.5,
          borderColor: problem ? theme.danger : theme.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          color: theme.text,
          backgroundColor: theme.background,
          fontSize: 18,
          letterSpacing: 2,
        }}
      />
      {problem ? (
        <View accessibilityLiveRegion="polite">
          <AppText color={theme.danger} style={{ fontWeight: '600' }}>
            {t(problem === 'invalid' ? 'points.link.invalid' : 'points.link.error')}
          </AppText>
        </View>
      ) : null}
      <AppText variant="caption" muted>
        {t('points.link.demoHint')}
      </AppText>
      <Button label={t('points.link.button')} onPress={() => void submit()} disabled={busy || code.trim().length === 0} />
    </Card>
  );
}

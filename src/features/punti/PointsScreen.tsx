import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { useAppState } from '@/lib/app-state';
import { isApiError } from '@/lib/api/errors';
import { pointsForVisit } from '@/lib/domain/point-rules';
import { describeDays, describeTimes, isAnyTime, type RuleWords } from '@/lib/domain/rule-text';
import { localTime } from '@/lib/domain/time';
import { formatShortDate } from '@/lib/format';
import { useDemoRevision, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/services-context';
import { MIN_TAP, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';
import type { LedgerReason, SiteSummary } from '@/schemas';

import { LinkCard } from './LinkCard';

export function PointsScreen() {
  return (
    <Screen>
      <GymGate>{(site) => <PointsContent site={site} />}</GymGate>
    </Screen>
  );
}

function PointsContent({ site }: { site: SiteSummary }) {
  const { t } = useI18n();
  const { memberSiteId } = useAppState();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="headline" accessibilityRole="header">
          {t('points.title')}
        </AppText>
        <AppText muted>{t('points.subtitle')}</AppText>
      </View>

      {!site.capabilities.points ? (
        // Capability check (spec §9.2): no named access control → no points, and the screen says so plainly.
        <Card>
          <SectionTitle>{t('points.unavailable.title')}</SectionTitle>
          <AppText muted>{t('points.unavailable.body')}</AppText>
        </Card>
      ) : memberSiteId !== site.site_id ? (
        <LinkCard site={site} />
      ) : (
        <LinkedPoints site={site} />
      )}
    </View>
  );
}

function LinkedPoints({ site }: { site: SiteSummary }) {
  const { t, lang, weekdayShort } = useI18n();
  const theme = useTheme();
  const api = useApi();
  const router = useRouter();
  const revision = useDemoRevision();
  const now = useNow(30_000);

  const points = useAsync(() => api.getPoints(), [api, revision]);
  const rewards = useAsync(() => api.getRewards(), [api, revision]);
  const redemptions = useAsync(() => api.getRedemptions(), [api, revision]);

  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const { setMemberSiteId } = useAppState();

  const reloadAll = (): void => {
    points.reload();
    rewards.reload();
    redemptions.reload();
  };

  // The service no longer knows this member (e.g. after data deletion): back to the link form.
  const notLinked = points.error?.code === 'not_linked';
  useEffect(() => {
    if (notLinked) setMemberSiteId(null);
  }, [notLinked, setMemberSiteId]);
  if (notLinked) return null;
  if (points.data === undefined) {
    return points.error ? (
      <View style={{ gap: spacing.lg }}>
        <Banner title={t('points.error')} />
        <Button label={t('common.retry')} onPress={reloadAll} />
      </View>
    ) : (
      <ActivityIndicator accessibilityLabel={t('state.loading')} style={{ marginTop: spacing.xl }} />
    );
  }

  const balance = points.data.balance;
  const local = localTime(new Date(now), site.timezone);
  // Credits are booked the night after a visit, so today's earned-credit count is 0 for a visit made now.
  const nowWorth = pointsForVisit(points.data.rules, local.weekday, local.minutes, 0).points;

  const words: RuleWords = {
    weekdayShort,
    everyDay: t('weekday.everyDay'),
    toClose: t('time.closing'),
  };

  async function redeem(rewardId: string): Promise<void> {
    setRedeeming(rewardId);
    setRedeemError(null);
    try {
      // A fresh random key per tap; a network retry of the same tap would reuse it (no double spend).
      const created = await api.createRedemption(rewardId, Crypto.randomUUID());
      reloadAll();
      router.push({ pathname: '/redemption/[id]', params: { id: created.id } });
    } catch (e) {
      const code = isApiError(e) ? e.code : 'generic';
      setRedeemError(code === 'out_of_stock' || code === 'insufficient_points' ? `points.redeem.error.${code}` : 'points.redeem.error.generic');
      reloadAll();
    } finally {
      setRedeeming(null);
    }
  }

  const reasonKey = (r: LedgerReason) => `ledger.${r}` as const;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <AppText muted style={{ fontWeight: '600' }}>
          {t('points.balance')}
        </AppText>
        <AppText variant="display" accessibilityLabel={t('points.balanceValue', { n: balance })}>
          {t('points.balanceValue', { n: balance })}
        </AppText>
        <AppText muted>{nowWorth > 0 ? t('points.nowWorth', { n: nowWorth }) : t('points.nowWorthZero')}</AppText>
      </Card>

      <Card>
        <SectionTitle>{t('points.rules.title')}</SectionTitle>
        {points.data.rules.map((rule) => {
          const days = describeDays(rule.weekday_mask, words);
          const text =
            rule.points === 0
              ? t('points.rules.peak', { days, times: describeTimes(rule, words) })
              : isAnyTime(rule)
                ? t('points.rules.itemAny', { days, points: rule.points })
                : t('points.rules.item', { days, times: describeTimes(rule, words), points: rule.points });
          return (
            <AppText key={rule.id} style={{ minHeight: 24 }}>
              {text}
            </AppText>
          );
        })}
        <AppText variant="caption" muted>
          {t('points.rules.footnote')}
        </AppText>
      </Card>

      <Card>
        <SectionTitle>{t('points.rewards.title')}</SectionTitle>
        <AppText variant="caption" muted>
          {t('points.rewards.note')}
        </AppText>
        {redeemError ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={theme.danger} style={{ fontWeight: '600' }}>
              {t(redeemError as 'points.redeem.error.generic')}
            </AppText>
          </View>
        ) : null}
        {(rewards.data?.rewards ?? []).map((reward) => {
          const soldOut = reward.stock === 0;
          const notEnough = balance < reward.cost;
          return (
            <View
              key={reward.id}
              style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
              <AppText style={{ fontWeight: '700' }}>{reward.title}</AppText>
              <AppText muted>
                {t('points.rewards.cost', { n: reward.cost })} ·{' '}
                {soldOut
                  ? t('points.rewards.soldOut')
                  : reward.stock === null
                    ? t('points.rewards.unlimited')
                    : t('points.rewards.stock', { n: reward.stock })}
              </AppText>
              <Button
                label={t('points.redeem')}
                accessibilityLabel={t('points.redeem.a11y', { title: reward.title, n: reward.cost })}
                onPress={() => void redeem(reward.id)}
                disabled={soldOut || notEnough || redeeming !== null}
              />
              {!soldOut && notEnough ? (
                <AppText variant="caption" muted>
                  {t('points.redeem.notEnough')}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </Card>

      {(redemptions.data?.redemptions.length ?? 0) > 0 ? (
        <Card>
          <SectionTitle>{t('points.codes.title')}</SectionTitle>
          {redemptions.data?.redemptions.map((r) => (
            <View key={r.id} style={{ gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
              <AppText style={{ fontWeight: '700' }}>{r.reward_title}</AppText>
              <AppText muted>
                {t(`redemption.status.${r.status}`)}
                {r.status === 'pending' ? ` · ${t('redemption.expires', { date: formatShortDate(lang, r.expires_at) })}` : ''}
              </AppText>
              <Button
                label={t('redemption.title')}
                accessibilityLabel={t('redemption.show', { title: r.reward_title })}
                variant="secondary"
                onPress={() => router.push({ pathname: '/redemption/[id]', params: { id: r.id } })}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t('points.ledger.title')}</SectionTitle>
        {points.data.ledger.length === 0 ? <AppText muted>{t('points.ledger.empty')}</AppText> : null}
        {points.data.ledger.slice(0, 15).map((entry) => (
          <View
            key={entry.id}
            accessible
            accessibilityLabel={`${t(reasonKey(entry.reason))}, ${formatShortDate(lang, entry.created_at)}, ${entry.delta > 0 ? '+' : '−'}${Math.abs(entry.delta)}`}
            style={{
              minHeight: MIN_TAP,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}>
            <View style={{ flex: 1 }}>
              <AppText>{t(reasonKey(entry.reason))}</AppText>
              <AppText variant="caption" muted>
                {formatShortDate(lang, entry.created_at)}
              </AppText>
            </View>
            {/* The sign is part of the text, so gain vs spend never relies on colour. */}
            <AppText style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {entry.delta > 0 ? '+' : '−'}
              {Math.abs(entry.delta)}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

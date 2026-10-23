import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionLabel, SectionTitle } from '@/components/Card';
import { ChevronRightIcon, StarFilledIcon, StarIcon } from '@/components/icons';
import { Orb } from '@/components/Orb';
import { PageTitle } from '@/components/PageTitle';
import { QrCode } from '@/components/QrCode';
import { Screen } from '@/components/Screen';
import { GymGate } from '@/features/common/GymGate';
import { decorativeA11yProps } from '@/lib/a11y';
import { useAppState } from '@/lib/app-state';
import { isApiError } from '@/lib/api/errors';
import { pointsForVisit } from '@/lib/domain/point-rules';
import { describeDays, describeTimes, isAnyTime, type RuleWords } from '@/lib/domain/rule-text';
import { localTime } from '@/lib/domain/time';
import { formatShortDate } from '@/lib/format';
import { useDemoRevision, useNow } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/services-context';
import { MIN_TAP, fontFamily, radius, spacing, useTheme } from '@/lib/theme';
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
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6, paddingHorizontal: 4 }}>
        <PageTitle icon={StarIcon} label={t('points.title')} circleSize={22} fontSize={26} />
        <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('points.subtitle')}
        </AppText>
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
  const codes = redemptions.data?.redemptions ?? [];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ borderRadius: radius.xxl, paddingVertical: spacing.xl, paddingHorizontal: 22, gap: 6, backgroundColor: theme.surface, overflow: 'hidden' }}>
        <View {...decorativeA11yProps} style={{ pointerEvents: 'none', position: 'absolute', top: -110, right: -100, width: 300, height: 300 }}>
          <Orb color={theme.accent} size={300} />
        </View>
        <AppText color={theme.textSoft} style={{ fontSize: 13, fontWeight: '600' }}>
          {t('points.balance')}
        </AppText>
        <AppText
          accessibilityLabel={t('points.balanceValue', { n: balance })}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: fontFamily.display, fontSize: 72, lineHeight: 76, letterSpacing: 72 * -0.07 }}>
          {balance}
        </AppText>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: radius.pill,
            backgroundColor: theme.chip,
          }}>
          <StarFilledIcon color={theme.accent} size={13} />
          <AppText style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 }}>
            {nowWorth > 0 ? t('points.nowWorth', { n: nowWorth }) : t('points.nowWorthZero')}
          </AppText>
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <SectionLabel>{t('points.rules.title')}</SectionLabel>
        {points.data.rules.map((rule) => {
          const days = describeDays(rule.weekday_mask, words);
          const peak = rule.points === 0;
          const spoken = peak
            ? t('points.rules.peak', { days, times: describeTimes(rule, words) })
            : isAnyTime(rule)
              ? t('points.rules.itemAny', { days, points: rule.points })
              : t('points.rules.item', { days, times: describeTimes(rule, words), points: rule.points });
          const when = peak
            ? t('points.rules.whenPeak', { days, times: describeTimes(rule, words) })
            : isAnyTime(rule)
              ? t('points.rules.whenAny', { days })
              : t('points.rules.when', { days, times: describeTimes(rule, words) });
          const pill = peak ? theme.band.red : theme.band.green;
          return (
            <View key={rule.id} accessible accessibilityLabel={spoken} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 34 }}>
              <AppText muted={peak} style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
                {when}
              </AppText>
              <View style={{ minWidth: 44, alignItems: 'center', paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: pill.soft }}>
                <AppText color={pill.onSoft} style={{ fontFamily: fontFamily.mono, fontSize: 12, lineHeight: 16 }}>
                  {peak ? '0' : `+${rule.points}`}
                </AppText>
              </View>
            </View>
          );
        })}
        <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 16 }}>
          {t('points.rules.footnote')}
        </AppText>
      </Card>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md, paddingHorizontal: 4 }}>
          <SectionTitle>{t('points.rewards.title')}</SectionTitle>
          <AppText color={theme.faint} style={{ fontSize: 11, lineHeight: 15, flexShrink: 1, textAlign: 'right' }}>
            {t('points.rewards.note')}
          </AppText>
        </View>
        {redeemError ? (
          <View accessibilityLiveRegion="polite">
            <AppText color={theme.danger} style={{ fontWeight: '600' }}>
              {t(redeemError as 'points.redeem.error.generic')}
            </AppText>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(rewards.data?.rewards ?? []).map((reward) => {
            const soldOut = reward.stock === 0;
            const notEnough = balance < reward.cost;
            const disabled = soldOut || notEnough || redeeming !== null;
            const reason = soldOut ? t('points.rewards.soldOut') : notEnough ? t('points.redeem.notEnough') : t('points.redeem');
            return (
              <View
                key={reward.id}
                style={{
                  flexBasis: '46%',
                  flexGrow: 1,
                  borderRadius: 22,
                  padding: 14,
                  gap: 10,
                  backgroundColor: theme.surface,
                  opacity: soldOut ? 0.55 : 1,
                }}>
                <View style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: theme.accent }}>
                  <AppText color={theme.onAccent} style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
                    {t('points.rewards.cost', { n: reward.cost })}
                  </AppText>
                </View>
                <AppText style={{ fontSize: 14, lineHeight: 18, fontWeight: '600', minHeight: 36 }}>{reward.title}</AppText>
                <AppText muted style={{ fontSize: 11, lineHeight: 14 }}>
                  {soldOut
                    ? t('points.rewards.soldOut')
                    : reward.stock === null
                      ? t('points.rewards.unlimited')
                      : t('points.rewards.stock', { n: reward.stock })}
                </AppText>
                <Pressable
                  onPress={() => void redeem(reward.id)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={t('points.redeem.a11y', { title: reward.title, n: reward.cost })}
                  accessibilityHint={disabled && reason !== t('points.redeem') ? reason : undefined}
                  accessibilityState={{ disabled }}
                  style={({ pressed }) => ({
                    minHeight: MIN_TAP,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.sm,
                    backgroundColor: soldOut || notEnough ? theme.surfaceAlt : theme.text,
                    opacity: pressed || (redeeming !== null && !soldOut && !notEnough) ? 0.75 : 1,
                  })}>
                  <AppText
                    color={soldOut || notEnough ? theme.faint : theme.background}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontSize: soldOut || notEnough ? 13 : 14, fontWeight: soldOut || notEnough ? '600' : '700' }}>
                    {reason}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {codes.length > 0
        ? codes.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/redemption/[id]', params: { id: r.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('redemption.show', { title: r.reward_title })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                borderRadius: radius.card,
                paddingVertical: spacing.lg,
                paddingHorizontal: 18,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              })}>
              <View {...decorativeA11yProps} style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode value={r.qr} size={30} accessibilityLabel="" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText muted style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 11 * 0.06, textTransform: 'uppercase' }}>
                  {t('points.codes.title')}
                </AppText>
                <AppText style={{ fontSize: 14, lineHeight: 19, fontWeight: '600' }}>{r.reward_title}</AppText>
                <AppText muted style={{ fontSize: 12, lineHeight: 16 }}>
                  {t(`redemption.status.${r.status}`)}
                  {r.status === 'pending' ? ` · ${t('redemption.expires', { date: formatShortDate(lang, r.expires_at) })}` : ''}
                </AppText>
              </View>
              <ChevronRightIcon color={theme.textMuted} size={16} strokeWidth={2.2} />
            </Pressable>
          ))
        : null}

      <Card style={{ gap: 0 }}>
        <View style={{ marginBottom: 6 }}>
          <SectionLabel>{t('points.ledger.title')}</SectionLabel>
        </View>
        {points.data.ledger.length === 0 ? <AppText muted>{t('points.ledger.empty')}</AppText> : null}
        {points.data.ledger.slice(0, 15).map((entry) => (
          <View
            key={entry.id}
            accessible
            accessibilityLabel={`${t(reasonKey(entry.reason))}, ${formatShortDate(lang, entry.created_at)}, ${entry.delta > 0 ? '+' : '−'}${Math.abs(entry.delta)}`}
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText style={{ fontSize: 14, lineHeight: 19 }}>{t(reasonKey(entry.reason))}</AppText>
              <AppText color={theme.faint} style={{ fontSize: 12, lineHeight: 16 }}>
                {formatShortDate(lang, entry.created_at)}
              </AppText>
            </View>
            {/* The sign is part of the text, so gain vs spend never relies on colour. */}
            <AppText
              color={entry.delta > 0 ? theme.band.green.onSoft : theme.text}
              style={{ fontFamily: fontFamily.mono, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] }}>
              {entry.delta > 0 ? '+' : '−'}
              {Math.abs(entry.delta)}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

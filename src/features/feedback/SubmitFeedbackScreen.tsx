import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, SectionTitle } from '@/components/Card';
import { ChevronLeftIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { StarRatingInput } from '@/components/StarRating';
import { useAuth } from '@/lib/auth/auth-context';
import { getMySiteCoaches, isDuplicateRating, submitCoachRating, submitIssueReport, type SiteCoach } from '@/lib/feedback-api';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

/** How long the auto-popup right after check-out stays open before it closes itself unattended. */
const AUTO_PROMPT_SECONDS = 120;

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Rating + issue report for one specific check-out. Reached two ways: automatically right after
 * check-out (`autoPrompt`, pushed from `use-real-checkin.ts#doCheckOut` — closes itself after
 * `AUTO_PROMPT_SECONDS` if left untouched), or manually any time later from the "Feedback" tab's own
 * list of recent check-outs (`ClientFeedbackScreen.tsx`, no countdown). Closing it with no
 * interaction writes nothing either way. The two paths below are fully independent: either, both, or
 * neither can be submitted.
 */
export function SubmitFeedbackScreen({ checkinId, autoPrompt = false }: { checkinId: number; autoPrompt?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const userId = auth.status === 'active' ? auth.session.user.id : null;
  const coaches = useAsync(() => getMySiteCoaches(), []);

  const [selectedCoach, setSelectedCoach] = useState<SiteCoach | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingState, setRatingState] = useState<'idle' | 'sent' | 'duplicate' | 'error'>('idle');

  const [issueText, setIssueText] = useState('');
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueState, setIssueState] = useState<'idle' | 'sent' | 'error'>('idle');

  // The popup that opens by itself after check-out closes after two minutes if nobody touches it. As soon as the member
  // starts writing or rating, the countdown stops and the chip disappears: it must never close on someone mid-sentence.
  const interacted = rating > 0 || selectedCoach !== null || comment.length > 0 || issueText.length > 0;
  const [remainingSeconds, setRemainingSeconds] = useState(AUTO_PROMPT_SECONDS);
  useEffect(() => {
    if (!autoPrompt || interacted) return;
    const interval = setInterval(() => setRemainingSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [autoPrompt, interacted]);
  useEffect(() => {
    if (autoPrompt && !interacted && remainingSeconds <= 0) router.back();
  }, [autoPrompt, interacted, remainingSeconds, router]);

  async function sendRating(): Promise<void> {
    if (!selectedCoach || rating === 0 || !userId) return;
    setRatingBusy(true);
    try {
      await submitCoachRating(checkinId, userId, selectedCoach.id, rating, comment.trim() || null);
      setRatingState('sent');
    } catch (e) {
      setRatingState(isDuplicateRating(e) ? 'duplicate' : 'error');
    } finally {
      setRatingBusy(false);
    }
  }

  async function sendIssue(): Promise<void> {
    const text = issueText.trim();
    if (!text || !userId) return;
    setIssueBusy(true);
    try {
      await submitIssueReport(checkinId, userId, text);
      setIssueState('sent');
      setIssueText('');
    } catch {
      setIssueState('error');
    } finally {
      setIssueBusy(false);
    }
  }

  const ratingSubmittable = selectedCoach !== null && rating > 0 && ratingState === 'idle';
  const ratingDone = ratingState === 'sent' || ratingState === 'duplicate';

  return (
    <Screen bottomPadding={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={{ width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
          <ChevronLeftIcon color={theme.text} size={20} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" accessibilityRole="header">
            {t('feedback.title')}
          </AppText>
        </View>
        {autoPrompt && !interacted ? (
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
            <AppText variant="caption" muted style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {t('feedback.autoPrompt.closesIn', { time: formatCountdown(remainingSeconds) })}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText muted style={{ fontSize: 14, lineHeight: 20, marginTop: -8 }}>
        {t('feedback.subtitle')}
      </AppText>

      <Card>
        <SectionTitle>{t('feedback.rating.title')}</SectionTitle>

        {coaches.loading && coaches.data === undefined ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} />
        ) : coaches.data && coaches.data.length === 0 ? (
          <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
            {t('feedback.rating.noCoaches')}
          </AppText>
        ) : ratingDone ? (
          <Banner message={t(ratingState === 'duplicate' ? 'feedback.rating.duplicate' : 'feedback.rating.sent')} />
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <AppText style={{ fontSize: 13, fontWeight: '600' }}>{t('feedback.rating.coachLabel')}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(coaches.data ?? []).map((c) => {
                  const selected = selectedCoach?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedCoach(c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={c.fullName ?? t('common.unnamedPerson')}
                      style={{
                        minHeight: MIN_TAP,
                        paddingHorizontal: spacing.lg,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? theme.text : theme.surfaceAlt,
                      }}>
                      <AppText color={selected ? theme.background : theme.text} style={{ fontWeight: '600', fontSize: 14 }}>
                        {c.fullName ?? t('common.unnamedPerson')}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <StarRatingInput value={rating} onChange={setRating} />

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('feedback.rating.commentPlaceholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('feedback.rating.commentPlaceholder')}
              multiline
              numberOfLines={3}
              style={{
                minHeight: 70,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                color: theme.text,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />

            {ratingState === 'error' ? <Banner title={t('feedback.rating.error')} /> : null}

            <Button label={t('feedback.rating.submit')} onPress={() => void sendRating()} disabled={!ratingSubmittable || ratingBusy} />
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('feedback.issue.title')}</SectionTitle>
        <AppText muted style={{ fontSize: 13, lineHeight: 18 }}>
          {t('feedback.issue.subtitle')}
        </AppText>

        {issueState === 'sent' ? (
          <Banner message={t('feedback.issue.sent')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={issueText}
              onChangeText={setIssueText}
              placeholder={t('feedback.issue.placeholder')}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t('feedback.issue.placeholder')}
              multiline
              numberOfLines={3}
              style={{
                minHeight: 70,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                color: theme.text,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
            {issueState === 'error' ? <Banner title={t('feedback.issue.error')} /> : null}
            <Button label={t('feedback.issue.submit')} onPress={() => void sendIssue()} disabled={issueText.trim() === '' || issueBusy} />
          </View>
        )}
      </Card>

      <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} style={{ minHeight: 56, marginTop: spacing.sm }} />
    </Screen>
  );
}

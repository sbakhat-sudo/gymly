import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon, XIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { getMyIssuesResolvedToday, type ResolvedIssueToday } from '@/lib/feedback-api';
import { useI18n } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

const DISMISSED_IDS_CAP = 200;

/**
 * "Manda una notifica al cliente... che resta visibile per tutto il giorno in home" (spec): with no
 * real push backend in this project (Expo Go constraint), the Home screen itself is the
 * notification — a coloured-accent alert card (badge, bold headline, description, a day/time
 * footer), one per issue resolved today at the Client's own gym (site-wide, on request — not only a
 * report this particular Client filed), each naming the actual problem (also on request) when the
 * original report had a description. Sits below the occupancy circle, not above it (on request).
 * Every Client at the site sees the same banners, so each one can dismiss it for themselves
 * (`dismissedResolvedIssueIds`, local-only — on request) without affecting anyone else's view; a
 * dismissed banner also naturally stops showing once `getMyIssuesResolvedToday` no longer returns it
 * tomorrow regardless, whichever happens first. A fixed system message, never Manager-written text —
 * the Manager still never messages the Client directly anywhere in this module.
 */
export function ResolvedIssueBanner() {
  const resolved = useAsync(() => getMyIssuesResolvedToday(), []);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    storage.get('dismissedResolvedIssueIds').then((v) => setDismissedIds(v ?? []));
  }, []);

  function dismiss(id: number): void {
    setDismissedIds((prev) => {
      const next = [...prev, id].slice(-DISMISSED_IDS_CAP);
      void storage.set('dismissedResolvedIssueIds', next);
      return next;
    });
  }

  if (!resolved.data) return null;
  const visible = resolved.data.filter((issue) => !dismissedIds.includes(issue.id));
  if (visible.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {visible.map((issue) => (
        <ResolvedIssueCard key={issue.id} issue={issue} onDismiss={() => dismiss(issue.id)} />
      ))}
    </View>
  );
}

function ResolvedIssueCard({ issue, onDismiss }: { issue: ResolvedIssueToday; onDismiss: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const description = issue.description?.trim();
  const message = description ? t('home.issueResolved.messageWithDescription', { description }) : t('home.issueResolved.message');

  return (
    <View style={[{ flexDirection: 'row', borderRadius: radius.card, backgroundColor: theme.surface, overflow: 'hidden' }, CARD_SHADOW]}>
      <View style={{ width: 4, backgroundColor: theme.band.green.solid }} />
      <View style={{ flex: 1, padding: spacing.md, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: theme.band.green.solid }}>
            <AppText color={theme.band.green.onSolid} style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('home.issueResolved.badge')}
            </AppText>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('home.issueResolved.dismiss')}
            hitSlop={8}
            style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginTop: -2, marginRight: -2 }}>
            <XIcon color={theme.textMuted} size={15} />
          </Pressable>
        </View>
        <AppText style={{ fontWeight: '800', fontSize: 15.5, lineHeight: 20 }}>{t('home.issueResolved.title')}</AppText>
        <AppText muted style={{ fontSize: 13.5, lineHeight: 18 }}>
          {message}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <CheckIcon color={theme.band.green.solid} size={13} strokeWidth={3} />
          <AppText variant="caption" muted style={{ fontSize: 11.5 }}>
            {t('home.issueResolved.today')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

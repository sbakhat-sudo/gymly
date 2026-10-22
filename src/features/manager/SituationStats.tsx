import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GaugeIcon, UsersIcon } from '@/components/icons';
import { CARD_SHADOW } from '@/lib/card-shadow';
import { formatRelativeTime } from '@/lib/format';
import { useI18n, type Lang } from '@/lib/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/lib/theme';
import type { Band } from '@/schemas';

import type { ActivityEvent } from './manager-api';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/** Caps the feed instead of letting it grow with every event today — past this many rows it
 * scrolls internally, so a busy day's card stays the same height as the presence list beside it
 * instead of pushing the page far past it. */
const ACTIVITY_LIST_MAX_HEIGHT = 460;

/**
 * "Occupazione" + "In palestra ora": the Manager's own real numbers, not a band — spec's "never a
 * people count" is a member-facing rule (CLAUDE.md constraint 4's own Manager exception already
 * covers the roster/presence list; this is the same gym, same exception). Both numbers are clients
 * only, same as the occupancy band itself — a Coach checked in for their shift doesn't make the gym
 * read as busier, so `presentCount` here is deliberately NOT the presence list's own "N" header
 * count (which includes Coaches too, since that one is a roster, not an occupancy reading).
 * `occupancyPct` is `null` while the gym is closed (nothing to divide against a meaningful "now"),
 * shown as a dash rather than a fabricated 0%.
 */
export function SituationStatCards({ occupancyPct, presentCount, band }: { occupancyPct: number | null; presentCount: number | null; band: Band | null }) {
  const { t, band: bandLabel } = useI18n();
  const theme = useTheme();
  const occupancyColors = band ? theme.band[band] : { soft: theme.surfaceAlt, onSoft: theme.textMuted };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <StatCard
        icon={GaugeIcon}
        label={t('manager.situation.occupancy.label')}
        value={occupancyPct === null ? '—' : `${occupancyPct}%`}
        caption={band ? bandLabel(band) : t('state.closed')}
        bg={occupancyColors.soft}
        fg={occupancyColors.onSoft}
      />
      <StatCard
        icon={UsersIcon}
        label={t('manager.presence.title')}
        value={presentCount === null ? '—' : String(presentCount)}
        caption={t('manager.situation.activeNow.caption')}
        bg={theme.primary + '1A'}
        fg={theme.primary}
      />
    </View>
  );
}

function StatCard({ icon: Icon, label, value, caption, bg, fg }: { icon: IconType; label: string; value: string; caption: string; bg: string; fg: string }) {
  return (
    <View style={[{ flex: 1, borderRadius: radius.card, padding: spacing.lg, gap: 6, backgroundColor: bg, alignItems: 'center' }, CARD_SHADOW]}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${fg}22` }}>
        <Icon color={fg} size={20} />
      </View>
      <AppText color={fg} numberOfLines={1} style={{ fontSize: 13, fontWeight: '600' }}>
        {label}
      </AppText>
      <AppText color={fg} numberOfLines={1} style={{ fontFamily: fontFamily.display, fontSize: 34, lineHeight: 40, fontWeight: '700' }}>
        {value}
      </AppText>
      <AppText color={fg} numberOfLines={1} style={{ fontSize: 12, opacity: 0.85 }}>
        {caption}
      </AppText>
    </View>
  );
}

/** "Attività in corso": the site's own recent check-in/check-out log, newest first — real names and
 * real timestamps, the same Manager-sees-real-data exception the stat cards above use. */
export function ActivityFeed({ events, error, lang }: { events: readonly ActivityEvent[] | null; error: boolean; lang: Lang }) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <View style={[{ borderRadius: radius.card, padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface }, CARD_SHADOW]}>
      <AppText accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800' }}>
        {t('manager.situation.activity.title')}
      </AppText>

      {error ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('manager.gym.error')}
        </AppText>
      ) : events === null ? null : events.length === 0 ? (
        <AppText muted style={{ fontSize: 13 }}>
          {t('manager.situation.activity.empty')}
        </AppText>
      ) : (
        <ScrollView style={{ maxHeight: ACTIVITY_LIST_MAX_HEIGHT }} contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {events.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: e.kind === 'checkin' ? theme.band.green.solid : theme.danger,
                }}
              />
              <View style={{ flex: 1 }}>
                <AppText numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>
                  {t(e.kind === 'checkin' ? 'manager.situation.activity.checkin' : 'manager.situation.activity.checkout')}
                </AppText>
                <AppText numberOfLines={1} muted style={{ fontSize: 12.5 }}>
                  {e.personName ?? t('common.unnamedPerson')}
                </AppText>
              </View>
              <AppText variant="caption" muted numberOfLines={1}>
                {formatRelativeTime(lang, e.at)}
              </AppText>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

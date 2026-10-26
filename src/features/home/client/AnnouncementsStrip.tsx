import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AlertTriangleIcon, ClockIcon, InfoIcon } from '@/components/icons';
import type { Announcement, AnnouncementKind } from '@/features/announcements/announcements-api';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';

const KIND_KEY: Record<AnnouncementKind, TranslationKey> = {
  info: 'manager.announcements.kind.info',
  warning: 'manager.announcements.kind.warning',
  closure: 'manager.announcements.kind.closure',
};

const MAX_SHOWN = 3;

/**
 * "Avvisi dalla palestra" at the very top of a Client's home: what the Manager wants every member to know today
 * (a closure, a change of hours, a machine out of order). Each notice is an icon + the kind in words + the text,
 * never colour alone. Shows nothing at all when there is no active notice.
 */
export function AnnouncementsStrip({ announcements }: { announcements: readonly Announcement[] }) {
  const { t } = useI18n();
  const theme = useTheme();
  if (announcements.length === 0) return null;

  const tint: Record<AnnouncementKind, { color: string; icon: typeof InfoIcon }> = {
    info: { color: theme.primary, icon: InfoIcon },
    warning: { color: theme.band.amber.solid, icon: AlertTriangleIcon },
    closure: { color: theme.band.red.solid, icon: ClockIcon },
  };
  const shown = announcements.slice(0, MAX_SHOWN);
  const more = announcements.length - shown.length;

  return (
    <View accessibilityRole="summary" style={{ gap: spacing.sm }}>
      {shown.map((a) => {
        const k = tint[a.kind];
        const Icon = k.icon;
        return (
          <View key={a.id} style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 4, borderLeftColor: k.color }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}>
              <Icon color={k.color} size={18} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ color: k.color, fontWeight: '800', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(KIND_KEY[a.kind])}</AppText>
              <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>{a.title}</AppText>
              {a.body ? (
                <AppText muted style={{ fontSize: 13.5, lineHeight: 19 }}>
                  {a.body}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
      {more > 0 ? (
        <AppText muted variant="caption" style={{ textAlign: 'center' }}>
          {t('home.client.moreAnnouncements', { n: more })}
        </AppText>
      ) : null}
    </View>
  );
}

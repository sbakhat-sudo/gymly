import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { InfoIcon, MapPinIcon, MoonIcon } from '@/components/icons';
import { radius, spacing, useTheme } from '@/lib/theme';

export type CheckinNoticeTone = 'tooFar' | 'closed' | 'info';

/**
 * A clean, soft card for what stands between a member and their check-in ("sei troppo lontano", "palestra chiusa",
 * "sei offline"…): an icon in a circle, a short bold title and one line saying what to do. Always icon + words, never
 * colour alone. Replaces the plain grey banner.
 */
export function CheckinNoticeCard({ tone, title, detail }: { tone: CheckinNoticeTone; title: string; detail?: string | null }) {
  const theme = useTheme();
  const Icon = tone === 'tooFar' ? MapPinIcon : tone === 'closed' ? MoonIcon : InfoIcon;
  const bg = tone === 'info' ? theme.surfaceAlt : theme.band.amber.soft;
  const fg = tone === 'info' ? theme.text : theme.band.amber.onSoft;
  const accent = tone === 'info' ? theme.textMuted : theme.band.amber.solid;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: bg }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }}>
        <Icon color={accent} size={22} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color={fg} style={{ fontWeight: '800', fontSize: 16 }}>
          {title}
        </AppText>
        {detail ? (
          <AppText color={fg} style={{ fontSize: 14, lineHeight: 19, opacity: 0.85 }}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

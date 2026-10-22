import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon, CreditCardIcon, RefreshIcon, UsersIcon, XIcon } from '@/components/icons';
import { formatRelativeTime } from '@/lib/format';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { spacing, useTheme } from '@/lib/theme';

import type { AdminActionEntry, AdminActionType } from './admin-api';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

/** One icon + one tint per action type — the same "what kind of action was this" signal at a glance,
 * everywhere this row is used. Green = something turned on/approved, red = something turned
 * off/rejected, neutral (primary/amber) = a plain change, never meaning "good" or "bad" on its own. */
const ACTION_ICON: Record<AdminActionType, IconType> = {
  site_approved: CheckIcon,
  site_suspended: XIcon,
  site_status_changed: RefreshIcon,
  site_plan_changed: CreditCardIcon,
  site_reassigned: UsersIcon,
  manager_activated: CheckIcon,
  manager_deactivated: XIcon,
  owner_activated: CheckIcon,
  owner_deactivated: XIcon,
};

function actionTint(type: AdminActionType, theme: ReturnType<typeof useTheme>): string {
  switch (type) {
    case 'site_approved':
    case 'manager_activated':
    case 'owner_activated':
      return theme.band.green.solid;
    case 'site_suspended':
    case 'manager_deactivated':
    case 'owner_deactivated':
      return theme.danger;
    case 'site_plan_changed':
      return theme.band.amber.solid;
    default:
      return theme.primary;
  }
}

/** One row — shared by the Dashboard's compact "Ultime azioni Admin", the full "Vedi tutto" log, and
 * Richieste's own request history, so all three always render the exact same sentence for the exact
 * same entry. `absolute` swaps the "2 ore fa" relative stamp for an explicit day+time — a permanent
 * request history reads better with a fixed date than one that keeps rephrasing itself as time passes. */
export function AdminActionRow({ entry, last, absolute = false }: { entry: AdminActionEntry; last: boolean; absolute?: boolean }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const sentence = t(`admin.actionsLog.type.${entry.actionType}` as TranslationKey, {
    entity: entry.entityLabel ?? '—',
    detail: entry.detail ?? '',
  });
  const when = absolute
    ? new Date(entry.createdAt).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : formatRelativeTime(lang, entry.createdAt);
  const Icon = ACTION_ICON[entry.actionType];
  const tint = actionTint(entry.actionType, theme);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.border,
      }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}22` }}>
        <Icon color={tint} size={15} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={2} style={{ fontSize: 14, fontWeight: '600' }}>
          {sentence}
        </AppText>
        <AppText variant="caption" muted>
          {entry.adminName ?? t('admin.actionsLog.unknownAdmin')} · {when}
        </AppText>
      </View>
    </View>
  );
}

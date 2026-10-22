import { ActivityIndicator, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Banner } from '@/components/Banner';
import { ClockIcon } from '@/components/icons';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { useI18n } from '@/lib/i18n';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { AdminActionRow } from './AdminActionRow';
import { getActionsLog } from './admin-api';

/** Full "Vedi tutto" log behind the Dashboard's compact "Ultime azioni Admin" table — same data,
 * same row rendering (`AdminActionRow`), just a longer list. */
export function AdminActionsLogScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const log = useAsync(() => getActionsLog(200), []);

  return (
    <Screen onRefresh={log.reload} refreshing={log.loading && log.data !== undefined}>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
        <BackButton href="/(admin)" />
        <PageTitle icon={ClockIcon} label={t('admin.actionsLog.fullTitle')} />
      </View>

      {log.error ? <Banner title={t('admin.actionsLog.error')} /> : null}
      {log.data === undefined && log.loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} /> : null}
      {log.data && log.data.length === 0 ? <Banner message={t('admin.actionsLog.empty')} /> : null}

      {log.data && log.data.length > 0 ? (
        <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }}>
          {log.data.map((entry, i, rows) => (
            <AdminActionRow key={entry.id} entry={entry} last={i === rows.length - 1} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Card, SectionLabel } from '@/components/Card';
import { GroupHeader } from '@/components/GroupHeader';
import { BellIcon, ChevronRightIcon, ClockIcon, CreditCardIcon, EyeIcon, GearIcon, SlidersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { SignOutButton } from '@/components/SignOutButton';
import { useAppState, type ThemePref } from '@/lib/app-state';
import { useI18n, type Lang } from '@/lib/i18n';
import { MIN_TAP, spacing, useTheme } from '@/lib/theme';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

export function AdminSettingsScreen() {
  const { t, lang } = useI18n();
  const { setLang, themePref, setThemePref } = useAppState();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <ScreenHeader icon={SlidersIcon} label={t('settings.title')} />
        <SignOutButton />
      </View>

      {/* Grouped by theme (platform config vs. security/logs) instead of one standalone Card per
          item — the flat list of near-identical single-row cards was the actual "disordinato"
          complaint: everything read as equally important with no structure to scan. */}
      <GroupHeader icon={GearIcon} label={t('admin.settings.platform')} />
      <Card style={{ padding: 0, gap: 0 }}>
        <NavRow href="/pagamento" label={t('admin.billing.title')} icon={CreditCardIcon} />
        <NavRow href="/comunicazioni" label={t('admin.broadcasts.title')} icon={BellIcon} last />
      </Card>

      <GroupHeader icon={EyeIcon} label={t('admin.settings.security')} />
      <Card style={{ padding: 0, gap: 0 }}>
        <NavRow href="/audit-gps" label={t('admin.gpsAudit.title')} icon={EyeIcon} />
        <NavRow href="/azioni-admin" label={t('admin.actionsLog.fullTitle')} icon={ClockIcon} last />
      </Card>

      <Card>
        <SectionLabel>{t('settings.language')}</SectionLabel>
        <Segmented<Lang>
          label={t('settings.language')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'it', label: t('settings.lang.it') },
            { value: 'en', label: t('settings.lang.en') },
          ]}
        />
      </Card>

      <Card>
        <SectionLabel>{t('settings.theme.title')}</SectionLabel>
        <Segmented<ThemePref>
          label={t('settings.theme.title')}
          value={themePref}
          onChange={setThemePref}
          options={[
            { value: 'auto', label: t('settings.theme.auto') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />
        <AppText muted style={{ fontSize: 12, lineHeight: 18 }}>
          {t('settings.theme.help')}
        </AppText>
      </Card>

      <AccountSection />
    </Screen>
  );
}

function NavRow({ href, label, icon: Icon, last = false }: { href: Href; label: string; icon: IconType; last?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: MIN_TAP + 6,
        paddingHorizontal: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.border,
      }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
        <Icon color={theme.text} size={16} />
      </View>
      <AppText style={{ fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</AppText>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

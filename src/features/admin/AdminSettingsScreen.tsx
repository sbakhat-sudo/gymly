import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Card, SectionLabel } from '@/components/Card';
import { BellIcon, ChevronRightIcon, CreditCardIcon, GearIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SignOutButton } from '@/components/SignOutButton';
import { useAppState, type ThemePref } from '@/lib/app-state';
import { useI18n, type Lang } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';

type IconType = (p: { color: string; size: number }) => React.ReactElement;

export function AdminSettingsScreen() {
  const { t, lang } = useI18n();
  const { setLang, themePref, setThemePref } = useAppState();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <AppText variant="display" style={{ fontSize: 32 }}>
          {t('settings.title')}
        </AppText>
        <SignOutButton />
      </View>

      {/* Each a separate, standalone section — not grouped into one list, so "Pagamento" reads as
          its own area rather than a sub-item of "Parametri". */}
      <SectionLabel>{t('admin.billing.title')}</SectionLabel>
      <Card>
        <NavRow href="/pagamento" label={t('admin.billing.title')} icon={CreditCardIcon} />
      </Card>

      <SectionLabel>{t('admin.params.title')}</SectionLabel>
      <Card>
        <NavRow href="/parametri" label={t('admin.params.title')} icon={GearIcon} />
      </Card>

      <SectionLabel>{t('admin.broadcasts.title')}</SectionLabel>
      <Card>
        <NavRow href="/comunicazioni" label={t('admin.broadcasts.title')} icon={BellIcon} />
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

function NavRow({ href, label, icon: Icon }: { href: Href; label: string; icon: IconType }) {
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
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
      }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceAlt }}>
        <Icon color={theme.text} size={16} />
      </View>
      <AppText style={{ fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</AppText>
      <ChevronRightIcon color={theme.textMuted} size={18} />
    </Pressable>
  );
}

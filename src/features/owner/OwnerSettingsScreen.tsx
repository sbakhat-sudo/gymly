import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { DumbbellIcon, SlidersIcon } from '@/components/icons';
import { ActivityCard } from '@/features/activity/ActivityCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PreferencesGroup } from '@/components/settings/PreferencesGroup';
import { ProfileHero } from '@/components/settings/ProfileHero';
import { SettingsBlock, SettingsGroup, SettingsIcon } from '@/components/settings/SettingsKit';
import { ProfileSection } from '@/components/ProfileSection';
import { logger } from '@/lib/logger';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

import { OwnerPlanSection } from './OwnerPlanSection';
import { getOwnerChainName, renameOwnerChain } from './owner-api';

/** The chain name gets an auto-generated default (the Owner's own full name) the moment Admin
 * approves them (admin_set_profile_status()) — there's no longer a one-time "name your business"
 * screen (see complete-profile.tsx's own docstring). This card is the only way to change it. */
function ChainNameRow() {
  const { t } = useI18n();
  const theme = useTheme();
  const chainName = useAsync(() => getOwnerChainName(), []);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function startEditing(): void {
    setName(chainName.data ?? '');
    setEditing(true);
  }

  async function save(): Promise<void> {
    if (name.trim().length === 0) return;
    setSaving(true);
    setError(false);
    try {
      await renameOwnerChain(name);
      await chainName.reload();
      setEditing(false);
    } catch (e) {
      logger.error('owner.rename_chain_failed', e);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    minHeight: MIN_TAP,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: theme.text,
    fontSize: 15,
  } as const;

  return (
    <EditableRow
      icon={DumbbellIcon}
      label={t('owner.settings.gym.name')}
      value={chainName.loading && !chainName.data ? '…' : (chainName.data ?? '—')}
      editing={editing}
      onEdit={startEditing}>
      <TextInput value={name} onChangeText={setName} placeholder={t('owner.settings.chainName.placeholder')} placeholderTextColor={theme.textMuted} style={inputStyle} />
      {error ? <Banner title={t('owner.settings.chainName.error')} /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label={t('common.close')} variant="secondary" onPress={() => setEditing(false)} />
        <Button label={t('owner.settings.chainName.save')} onPress={() => void save()} disabled={saving || name.trim().length === 0} />
      </View>
    </EditableRow>
  );
}

/** One line of the "La tua palestra" group: icon, what it is, its current value — and "Modifica" on the same
 * row. Tapping it opens the edit form right underneath, inside the same group. */
function EditableRow({
  icon,
  label,
  value,
  editing,
  onEdit,
  children,
}: {
  icon: (p: { color: string; size: number }) => React.ReactElement;
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <SettingsIcon icon={icon} />
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="caption" muted style={{ fontWeight: '600' }}>
            {label}
          </AppText>
          <AppText style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
            {value}
          </AppText>
        </View>
        {!editing ? (
          <AppText onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${t('owner.settings.chainName.edit')}: ${label}`} style={{ color: theme.primary, fontWeight: '700', fontSize: 13, paddingVertical: 8, paddingLeft: 8 }}>
            {t('owner.settings.chainName.edit')}
          </AppText>
        ) : null}
      </View>
      {editing ? <SettingsBlock>{children}</SettingsBlock> : null}
    </View>
  );
}

export function OwnerSettingsScreen() {
  const { t } = useI18n();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl }}>
        <ScreenHeader icon={SlidersIcon} label={t('settings.title')} />
      </View>

      <ProfileHero />

      <SettingsGroup title={t('owner.settings.gym.title')}>
        <ChainNameRow />
      </SettingsGroup>

      <OwnerPlanSection />

      <ActivityCard roles={['manager', 'coach', 'client']} />

      <PreferencesGroup withTheme />

      <ProfileSection />

      <AccountSection />
    </Screen>
  );
}

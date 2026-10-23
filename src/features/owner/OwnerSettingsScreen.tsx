import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { AccountSection } from '@/components/AccountSection';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CheckIcon, DumbbellIcon, SlidersIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PreferencesGroup } from '@/components/settings/PreferencesGroup';
import { ProfileHero } from '@/components/settings/ProfileHero';
import { SettingsBlock, SettingsGroup, SettingsIcon } from '@/components/settings/SettingsKit';
import { ProfileSection } from '@/components/ProfileSection';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { MIN_TAP, radius, spacing, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/use-async';

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

type TotpFactor = { id: string; status: string };

/** Real TOTP two-factor authentication via Supabase Auth's own built-in MFA (`supabase.auth.mfa.*`)
 * — no new backend, this is a native Supabase Auth feature. Deliberately scoped to the Owner role
 * only for now (the pasted reference design's own "Sicurezza" card); no other role in this app has
 * a 2FA UI yet. */
function SecurityCard() {
  const { t } = useI18n();
  const theme = useTheme();
  const factors = useAsync(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp ?? []).filter((f) => f.status === 'verified') as TotpFactor[];
  }, []);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolledFactor = factors.data?.[0] ?? null;

  async function startEnroll(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (err) throw err;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(true);
    } catch (e) {
      logger.error('owner.mfa_enroll_failed', e);
      setError(t('owner.settings.security.error'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(): Promise<void> {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
      if (verifyErr) throw verifyErr;
      setEnrolling(false);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setCode('');
      factors.reload();
    } catch (e) {
      logger.error('owner.mfa_verify_failed', e);
      setError(t('owner.settings.security.invalidCode'));
    } finally {
      setBusy(false);
    }
  }

  async function disable(): Promise<void> {
    if (!enrolledFactor) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactor.id });
      if (err) throw err;
      factors.reload();
    } catch (e) {
      logger.error('owner.mfa_unenroll_failed', e);
      // Supabase requires the aal2 level (i.e. having actually used 2FA this session) to remove an
      // already-verified factor — the most likely real cause here, worth its own message.
      setError(t('owner.settings.security.disableNeedsReauth'));
    } finally {
      setBusy(false);
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
    textAlign: 'center' as const,
    letterSpacing: 4,
  };

  return (
    <SettingsGroup title={t('owner.settings.security.title')}>
      <SettingsBlock>

      {enrolledFactor ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CheckIcon color={theme.band.green.solid} size={16} />
            <AppText style={{ color: theme.band.green.solid, fontWeight: '700', fontSize: 13 }}>{t('owner.settings.security.active')}</AppText>
          </View>
          {error ? <Banner title={error} /> : null}
          <Button label={t('owner.settings.security.disable')} variant="dangerSoft" onPress={() => void disable()} disabled={busy} />
        </View>
      ) : enrolling ? (
        <View style={{ gap: spacing.sm }}>
          <AppText muted style={{ fontSize: 13 }}>
            {t('owner.settings.security.scanHelp')}
          </AppText>
          {Platform.OS === 'web' && qrCode ? (
            // Plain web <img>, same web-only raw-HTML convention already used for the Maps <iframe>
            // in ManagerPositionCard.tsx/OwnerManagersScreen.tsx — this screen never runs natively.
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`} alt={t('owner.settings.security.qrAlt')} width={180} height={180} style={{ alignSelf: 'center' }} />
          ) : null}
          {secret ? (
            <AppText style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'center' }} selectable>
              {secret}
            </AppText>
          ) : null}
          <TextInput value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={theme.textMuted} keyboardType="number-pad" maxLength={6} style={inputStyle} />
          {error ? <Banner title={error} /> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label={t('common.close')} variant="secondary" onPress={() => setEnrolling(false)} />
            <Button label={t('owner.settings.security.verify')} onPress={() => void verify()} disabled={busy || code.trim().length !== 6} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <AppText muted style={{ fontSize: 13 }}>
            {t('owner.settings.security.help')}
          </AppText>
          {error ? <Banner title={error} /> : null}
          <Button label={t('owner.settings.security.enable')} onPress={() => void startEnroll()} disabled={busy} />
        </View>
      )}
      </SettingsBlock>
    </SettingsGroup>
  );
}

/**
 * First pass, deliberately smaller than the pasted reference design in one place: "Notifiche"
 * (email notifications) is skipped — this project has no real email-sending backend (only Supabase
 * Auth's own account-confirmation emails), so a toggle for it would control nothing real. Posizione
 * sede and Sicurezza (real TOTP via Supabase Auth) below ARE wired to something real.
 */
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

      <PreferencesGroup withTheme />

      <ProfileSection />

      <SecurityCard />

      <AccountSection />
    </Screen>
  );
}

import { useAppState, type ThemePref } from '@/lib/app-state';
import { useI18n, type Lang } from '@/lib/i18n';

import { LightbulbIcon, MessageCircleIcon } from '../icons';
import { SettingsChoiceRow, SettingsGroup } from './SettingsKit';

/** "Preferenze": the language and light / dark / automatic, for every role (`withTheme={false}` hides the theme row). */
export function PreferencesGroup({ withTheme = true }: { withTheme?: boolean }) {
  const { t, lang } = useI18n();
  const { setLang, themePref, setThemePref } = useAppState();

  return (
    <SettingsGroup title={t('settings.preferences')}>
      <SettingsChoiceRow<Lang>
        icon={MessageCircleIcon}
        label={t('settings.language')}
        value={lang}
        onChange={setLang}
        options={[
          { value: 'it', label: t('settings.lang.it') },
          { value: 'en', label: t('settings.lang.en') },
        ]}
      />
      {withTheme ? (
        <SettingsChoiceRow<ThemePref>
          icon={LightbulbIcon}
          label={t('settings.theme.title')}
          value={themePref}
          onChange={setThemePref}
          help={t('settings.theme.help')}
          options={[
            { value: 'auto', label: t('settings.theme.auto') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />
      ) : null}
    </SettingsGroup>
  );
}

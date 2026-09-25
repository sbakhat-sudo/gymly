import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Band, Weekday } from '@/schemas';

import { en } from './en';
import { it, type TranslationKey } from './it';

export type Lang = 'it' | 'en';
export const DEFAULT_LANG: Lang = 'it';
export type { TranslationKey };

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { it, en };

export type Params = Record<string, string | number>;

/** Translates `key`, replacing `{name}` placeholders. Unknown placeholders are left untouched. */
export function translate(lang: Lang, key: TranslationKey, params?: Params): string {
  const template = dictionaries[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** "12 secondi", "1 minuto", "2 ore" — whole units, rounded down. */
export function formatDuration(lang: Lang, seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pick = (n: number, base: 'secondsAgo' | 'minutesAgo' | 'hoursAgo'): string =>
    translate(lang, `time.${base}.${n === 1 ? 'one' : 'other'}`, { n });
  if (s < 60) return pick(s, 'secondsAgo');
  if (s < 3600) return pick(Math.floor(s / 60), 'minutesAgo');
  return pick(Math.floor(s / 3600), 'hoursAgo');
}

interface I18nValue {
  lang: Lang;
  t: (key: TranslationKey, params?: Params) => string;
  /** Duration formatted in the active language, e.g. "40 secondi". */
  duration: (seconds: number) => string;
  /** "Affollata" / "Crowded". */
  band: (band: Band) => string;
  weekday: (weekday: Weekday) => string;
  weekdayShort: (weekday: Weekday) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: (key, params) => translate(lang, key, params),
      duration: (seconds) => formatDuration(lang, seconds),
      band: (band) => translate(lang, `band.${band}`),
      weekday: (weekday) => translate(lang, `weekday.${weekday}`),
      weekdayShort: (weekday) => translate(lang, `weekday.short.${weekday}`),
    }),
    [lang]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

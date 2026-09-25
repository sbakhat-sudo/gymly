import { en } from '../en';
import { formatDuration, translate } from '../index';
import { it as itDict } from '../it';

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('dictionaries', () => {
  it('Italian and English define exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(itDict).sort());
  });

  it('no translation is empty', () => {
    for (const dict of [itDict, en]) {
      for (const value of Object.values(dict)) expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('every key uses the same placeholders in both languages', () => {
    for (const key of Object.keys(itDict) as (keyof typeof itDict)[]) {
      expect(placeholders(en[key])).toEqual(placeholders(itDict[key]));
    }
  });

  it('band labels are the ones mandated by the spec', () => {
    expect([translate('it', 'band.green'), translate('it', 'band.amber'), translate('it', 'band.red')]).toEqual([
      'Libera',
      'Moderata',
      'Affollata',
    ]);
    expect(translate('it', 'state.unavailable')).toBe('Dato non disponibile');
  });
});

describe('translate', () => {
  it('substitutes placeholders', () => {
    expect(translate('it', 'time.updated', { ago: '40 secondi' })).toBe('aggiornato 40 secondi fa');
    expect(translate('en', 'time.updated', { ago: '40 seconds' })).toBe('updated 40 seconds ago');
  });

  it('leaves unknown placeholders visible instead of throwing', () => {
    expect(translate('it', 'time.updated')).toBe('aggiornato {ago} fa');
    expect(translate('it', 'time.updated', { other: 1 })).toBe('aggiornato {ago} fa');
  });

  it('does not interpret replacement values as code or patterns', () => {
    expect(translate('it', 'time.updated', { ago: '$& {ago}' })).toBe('aggiornato $& {ago} fa');
  });
});

describe('formatDuration', () => {
  it.each([
    ['it', 0, '0 secondi'],
    ['it', 1, '1 secondo'],
    ['it', 40, '40 secondi'],
    ['it', 60, '1 minuto'],
    ['it', 125, '2 minuti'],
    ['it', 3600, '1 ora'],
    ['it', 7300, '2 ore'],
    ['en', 1, '1 second'],
    ['en', 59, '59 seconds'],
    ['en', 61, '1 minute'],
    ['en', 7200, '2 hours'],
  ] as const)('%s %i s → %s', (lang, seconds, expected) => {
    expect(formatDuration(lang, seconds)).toBe(expected);
  });

  it('clamps negatives and rounds down', () => {
    expect(formatDuration('it', -5)).toBe('0 secondi');
    expect(formatDuration('it', 59.9)).toBe('59 secondi');
  });
});

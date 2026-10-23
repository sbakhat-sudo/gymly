import { isPlausibleName, isPlausiblePhone } from '../input-checks';

describe('isPlausibleName', () => {
  it.each(['Mario', 'Anna Maria', "D'Angelo", 'Müller', 'Jean-Luc', 'José', 'Łukasz', 'De Rossi Jr.'])('accepts %s', (name) => {
    expect(isPlausibleName(name)).toBe(true);
  });

  it('refuses an email address', () => {
    expect(isPlausibleName('titolare@gymly.test')).toBe(false);
  });

  it.each(['', '   ', '12345', 'Mario1', '@mario', '-Mario'])('refuses %p', (name) => {
    expect(isPlausibleName(name)).toBe(false);
  });

  it('refuses a name that is far too long', () => {
    expect(isPlausibleName('a'.repeat(81))).toBe(false);
  });

  it('ignores surrounding spaces', () => {
    expect(isPlausibleName('  Mario  ')).toBe(true);
  });
});

describe('isPlausiblePhone', () => {
  it.each(['3331234567', '+39 333 123 4567', '(02) 1234-5678', '+1.555.123.4567'])('accepts %s', (phone) => {
    expect(isPlausiblePhone(phone)).toBe(true);
  });

  it('refuses an email address', () => {
    expect(isPlausiblePhone('titolare@gymly.test')).toBe(false);
  });

  it.each(['', '12345', '+', 'abc123456', '1234567890123456'])('refuses %p', (phone) => {
    expect(isPlausiblePhone(phone)).toBe(false);
  });
});

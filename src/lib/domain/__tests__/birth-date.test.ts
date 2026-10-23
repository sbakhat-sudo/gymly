import { formatBirthInput, parseBirthDate } from '../birth-date';

const TODAY = new Date(2026, 9, 23); // 23 October 2026

describe('formatBirthInput', () => {
  it('inserts the slashes while typing', () => {
    expect(formatBirthInput('1')).toBe('1');
    expect(formatBirthInput('12')).toBe('12');
    expect(formatBirthInput('120')).toBe('12/0');
    expect(formatBirthInput('1203')).toBe('12/03');
    expect(formatBirthInput('12031')).toBe('12/03/1');
    expect(formatBirthInput('12031990')).toBe('12/03/1990');
  });

  it('keeps only digits and at most eight of them', () => {
    expect(formatBirthInput('12a/03-1990xx99')).toBe('12/03/1990');
  });
});

describe('parseBirthDate', () => {
  it('turns a real date into ISO', () => {
    expect(parseBirthDate('12/03/1990', TODAY)).toBe('1990-03-12');
  });

  it('rejects shapes that are not GG/MM/AAAA', () => {
    expect(parseBirthDate('', TODAY)).toBeNull();
    expect(parseBirthDate('1/3/1990', TODAY)).toBeNull();
    expect(parseBirthDate('1990-03-12', TODAY)).toBeNull();
  });

  it('rejects dates that do not exist', () => {
    expect(parseBirthDate('31/02/1990', TODAY)).toBeNull();
    expect(parseBirthDate('29/02/2001', TODAY)).toBeNull();
    expect(parseBirthDate('10/13/1990', TODAY)).toBeNull();
    expect(parseBirthDate('00/05/1990', TODAY)).toBeNull();
  });

  it('accepts a leap day in a leap year', () => {
    expect(parseBirthDate('29/02/2000', TODAY)).toBe('2000-02-29');
  });

  it('rejects anyone younger than 16 on the given day', () => {
    expect(parseBirthDate('24/10/2010', TODAY)).toBeNull(); // turns 16 tomorrow
    expect(parseBirthDate('23/10/2010', TODAY)).toBe('2010-10-23'); // turns 16 today
  });

  it('rejects anyone older than 110', () => {
    expect(parseBirthDate('22/10/1916', TODAY)).toBeNull();
    expect(parseBirthDate('23/10/1916', TODAY)).toBe('1916-10-23');
  });
});

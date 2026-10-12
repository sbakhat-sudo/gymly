import { bandRanges, widestRange } from '../weekly-stats';

describe('bandRanges', () => {
  it('groups consecutive same-band hours into one range', () => {
    const hours = [
      { hour: 6, band: 'green' as const },
      { hour: 7, band: 'green' as const },
      { hour: 8, band: 'green' as const },
      { hour: 9, band: 'amber' as const },
      { hour: 18, band: 'red' as const },
      { hour: 19, band: 'red' as const },
    ];
    expect(bandRanges(hours)).toEqual({
      green: [{ from: 6, to: 9 }],
      amber: [{ from: 9, to: 10 }],
      red: [{ from: 18, to: 20 }],
    });
  });

  it('a gap in the hours breaks the run even when the band repeats', () => {
    const hours = [
      { hour: 6, band: 'green' as const },
      { hour: 7, band: 'green' as const },
      // hour 8 missing (closed/no data)
      { hour: 9, band: 'green' as const },
    ];
    expect(bandRanges(hours).green).toEqual([
      { from: 6, to: 8 },
      { from: 9, to: 10 },
    ]);
  });

  it('empty input yields empty ranges for every band', () => {
    expect(bandRanges([])).toEqual({ green: [], amber: [], red: [] });
  });

  it('is order-independent (sorts internally)', () => {
    const hours = [
      { hour: 10, band: 'amber' as const },
      { hour: 6, band: 'green' as const },
      { hour: 7, band: 'green' as const },
    ];
    expect(bandRanges(hours).green).toEqual([{ from: 6, to: 8 }]);
  });
});

describe('widestRange', () => {
  it('picks the longest range', () => {
    expect(widestRange([{ from: 6, to: 8 }, { from: 12, to: 17 }])).toEqual({ from: 12, to: 17 });
  });

  it('returns null for no ranges', () => {
    expect(widestRange([])).toBeNull();
  });

  it('ties keep the first one seen', () => {
    expect(widestRange([{ from: 6, to: 8 }, { from: 12, to: 14 }])).toEqual({ from: 6, to: 8 });
  });
});

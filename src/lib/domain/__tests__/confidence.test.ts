import { computeConfidence, type ConfidenceInput } from '../confidence';

const base: ConfidenceInput = {
  adapterClass: 'access_control_exits',
  calibrationAgeDays: 10,
  mape: 0.02,
  stalenessS: 30,
  stalenessLimitS: 300,
  anomaly: false,
  capacitySource: 'p95',
};
const with_ = (patch: Partial<ConfidenceInput>): ConfidenceInput => ({ ...base, ...patch });

describe('computeConfidence (spec §4.5)', () => {
  describe('high', () => {
    it('access control with exits and fresh data', () => {
      expect(computeConfidence(base)).toBe('high');
    });
    it('bidirectional edge counter is treated like access control with exits', () => {
      expect(computeConfidence(with_({ adapterClass: 'edge_counter' }))).toBe('high');
    });
    it('needs staleness strictly below 120 s', () => {
      expect(computeConfidence(with_({ stalenessS: 119 }))).toBe('high');
      expect(computeConfidence(with_({ stalenessS: 120 }))).toBe('medium');
    });
  });

  describe('medium', () => {
    it('WiFi with MAPE ≤ 15%', () => {
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: 0.12 }))).toBe('medium');
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: 0.15 }))).toBe('medium');
    });
    it('entry-only turnstile is capped at medium even when fresh and accurate', () => {
      expect(computeConfidence(with_({ adapterClass: 'access_control_entry_only', mape: 0.05 }))).toBe('medium');
    });
    it('exits but staleness between 120 s and 300 s', () => {
      expect(computeConfidence(with_({ stalenessS: 200 }))).toBe('medium');
    });
    it('is capped at medium while capacity_reference is operator-entered (< 90 days of history, §4.4)', () => {
      expect(computeConfidence(with_({ capacitySource: 'operator' }))).toBe('medium');
    });
  });

  describe('low', () => {
    it('WiFi with MAPE > 15%', () => {
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: 0.16 }))).toBe('low');
    });
    it('model-based source without a verified MAPE', () => {
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: null }))).toBe('low');
    });
    it('model-based source with a calibration older than 60 days', () => {
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: 0.1, calibrationAgeDays: 61 }))).toBe('low');
      expect(computeConfidence(with_({ adapterClass: 'wifi', mape: 0.1, calibrationAgeDays: 60 }))).toBe('medium');
    });
    it('manual counts are never primary-quality', () => {
      expect(computeConfidence(with_({ adapterClass: 'manual' }))).toBe('low');
    });
    it('staleness ≥ 300 s while still under a longer site limit', () => {
      expect(computeConfidence(with_({ stalenessS: 400, stalenessLimitS: 600 }))).toBe('low');
    });
  });

  describe('unavailable', () => {
    it('any anomaly forces unavailable, whatever the adapter', () => {
      expect(computeConfidence(with_({ anomaly: true }))).toBe('unavailable');
    });
    it('estimate as old as the site staleness limit', () => {
      expect(computeConfidence(with_({ stalenessS: 300 }))).toBe('unavailable');
      expect(computeConfidence(with_({ stalenessS: 299 }))).toBe('medium');
    });
    it('beats every other rule', () => {
      expect(computeConfidence(with_({ adapterClass: 'manual', anomaly: true }))).toBe('unavailable');
    });
  });
});

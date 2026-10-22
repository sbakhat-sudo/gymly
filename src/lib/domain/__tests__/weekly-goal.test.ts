import { computeCheckoutGoalMessage, formatDateKey } from '../weekly-goal';

describe('computeCheckoutGoalMessage', () => {
  it('reports sessions remaining while below the goal', () => {
    expect(computeCheckoutGoalMessage(1, 3)).toEqual({ kind: 'progress', remaining: 2 });
    expect(computeCheckoutGoalMessage(2, 3)).toEqual({ kind: 'progress', remaining: 1 });
  });

  it('congratulates exactly on the checkout that reaches the goal', () => {
    expect(computeCheckoutGoalMessage(3, 3)).toEqual({ kind: 'reached' });
    expect(computeCheckoutGoalMessage(5, 5)).toEqual({ kind: 'reached' });
  });

  it('says nothing once the goal was already exceeded earlier this week', () => {
    expect(computeCheckoutGoalMessage(4, 3)).toBeNull();
    expect(computeCheckoutGoalMessage(6, 5)).toBeNull();
  });
});

describe('formatDateKey', () => {
  it('formats in the local calendar, not UTC', () => {
    expect(formatDateKey(new Date(2026, 8, 21))).toBe('2026-09-21');
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

export type WeeklyGoal = 1 | 2 | 3 | 4 | 5;

/** What a checkout alone can produce — never `missed`, which only makes sense once a week has fully
 * ended (see `WeeklyGoalPopup.tsx`), not at the moment of an individual checkout. */
export type CheckoutGoalMessage = { kind: 'progress'; remaining: number } | { kind: 'reached' };

/** Every message the popup can show, checkout-triggered or end-of-week. */
export type GoalPopupMessage = CheckoutGoalMessage | { kind: 'missed' };

/**
 * Called right after a checkout completes: `sessionsThisWeek` already counts the one that just
 * finished. `null` means nothing to say — the goal was already reached earlier this week, so this
 * isn't the checkout that crossed the threshold (congratulated once, not on every checkout after).
 */
export function computeCheckoutGoalMessage(sessionsThisWeek: number, goal: WeeklyGoal): CheckoutGoalMessage | null {
  if (sessionsThisWeek === goal) return { kind: 'reached' };
  if (sessionsThisWeek < goal) return { kind: 'progress', remaining: goal - sessionsThisWeek };
  return null;
}

/** `YYYY-MM-DD` in the device's own local calendar — deliberately not UTC (`toISOString` would shift
 * the date near midnight) and deliberately not site-timezone-aware: this just needs to match
 * whichever week a Client's own device considers "this week" to be, same as `startOfWeek`. */
export function formatDateKey(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type ReviewGoal = 'iron' | 'fat';

function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

// A UI reminder interval only, not a clinical review schedule.
export function hasOlderGoalReview(amount: number | null, reviewedOn: string | null, today: string): boolean {
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || !reviewedOn) return false;
  const review = calendarDate(reviewedOn);
  const now = calendarDate(today);
  if (!review || !now) return false;
  const year = review.getUTCFullYear() + 1;
  const month = review.getUTCMonth();
  const day = Math.min(review.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return now.getTime() >= Date.UTC(year, month, day);
}

export function goalReviewDismissalKey(userId: string, personId: number, goal: ReviewGoal, amount: number, reviewedOn: string): string {
  return `clear-access-goal-review:v1:${JSON.stringify([userId, personId, goal, amount, reviewedOn])}`;
}

export function readGoalReviewDismissal(key: string): boolean {
  try { return window.localStorage.getItem(key) === 'dismissed'; }
  catch { return false; }
}

export function saveGoalReviewDismissal(key: string): boolean {
  try { window.localStorage.setItem(key, 'dismissed'); return true; }
  catch { return false; }
}

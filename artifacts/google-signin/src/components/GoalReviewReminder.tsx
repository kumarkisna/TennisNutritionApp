import React, { useState } from 'react';
import type { Person } from '@workspace/api-client-react';
import { goalReviewDismissalKey, hasOlderGoalReview, readGoalReviewDismissal, saveGoalReviewDismissal, type ReviewGoal } from '../lib/goal-review-reminder';

function Reminder({ storageKey, goal, reviewedOn }: { storageKey: string; goal: ReviewGoal; reviewedOn: string }) {
  const [dismissed, setDismissed] = useState(() => readGoalReviewDismissal(storageKey));
  const [sessionOnly, setSessionOnly] = useState(false);
  if (dismissed) return sessionOnly
    ? <p role="status" className="mt-3 text-xs text-[#6d7a79]">Reminder dismissed for this visit. Browser storage is unavailable, so it may return next time.</p>
    : null;
  return <aside className="mt-4 rounded-xl border border-[#d7e4df] bg-[#f1f6f3] p-4 text-xs leading-5 text-[#5d6d71]" data-testid={`reminder-goal-review-${goal}`}>
    <p className="font-bold text-[#183542]">Revisit your {goal} goal?</p>
    <p>Your saved professional-review date is {reviewedOn}, at least 12 months ago. Consider revisiting this goal with a qualified professional when convenient.</p>
    <p className="mt-1">The 12-month interval is only an app reminder, not a medical deadline or a judgment about your goal. The date is user-provided and not verified. No personal details are needed.</p>
    <button type="button" className="mt-2 font-bold text-[#176d61] underline" data-testid={`dismiss-goal-review-${goal}`}
      onClick={() => { setSessionOnly(!saveGoalReviewDismissal(storageKey)); setDismissed(true); }}>
      Dismiss {goal} reminder
    </button>
    <p className="mt-1">Dismissal is saved on this browser for this person’s current goal and review date.</p>
  </aside>;
}

export function GoalReviewReminders({ person, userId, today }: { person: Person; userId: string; today: string }) {
  const goals = [
    { goal: 'iron' as const, amount: person.ironGoalMg, reviewedOn: person.ironGoalReviewedOn },
    { goal: 'fat' as const, amount: person.fatGoalG, reviewedOn: person.fatGoalReviewedOn },
  ];
  return <>{goals.map(({ goal, amount, reviewedOn }) => {
    if (!hasOlderGoalReview(amount, reviewedOn, today) || amount === null || !reviewedOn) return null;
    const key = goalReviewDismissalKey(userId, person.id, goal, amount, reviewedOn);
    return <Reminder key={key} storageKey={key} goal={goal} reviewedOn={reviewedOn} />;
  })}</>;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '@workspace/api-client-react';
import { GoalReviewReminders } from '../src/components/GoalReviewReminder';
import { goalReviewDismissalKey, hasOlderGoalReview, readGoalReviewDismissal, saveGoalReviewDismissal } from '../src/lib/goal-review-reminder';

test('reminds from the one-year anniversary, including leap-day reviews', () => {
  assert.equal(hasOlderGoalReview(18, '2025-10-12', '2026-10-11'), false);
  assert.equal(hasOlderGoalReview(18, '2025-10-12', '2026-10-12'), true);
  assert.equal(hasOlderGoalReview(18, '2024-02-29', '2025-02-27'), false);
  assert.equal(hasOlderGoalReview(18, '2024-02-29', '2025-02-28'), true);
});

test('no reminder for absent goals, missing, invalid, recent or future dates', () => {
  for (const date of [null, '', '2025-02-30', 'invalid', '2026-02-12', '2027-10-12']) {
    assert.equal(hasOlderGoalReview(18, date, '2026-10-12'), false);
  }
  for (const amount of [null, 0, NaN]) {
    assert.equal(hasOlderGoalReview(amount, '2020-01-01', '2026-10-12'), false);
  }
});

const person = {
  id: 101, name: 'Test person', ageYears: null, weightKg: null,
  ironGoalMg: 18, ironGoalReviewedOn: '2020-01-01',
  fatGoalG: 70, fatGoalReviewedOn: '2026-10-01',
} as Person;

test('shows only the older saved goal, with an accessible dismissal and nonclinical explanation', () => {
  const html = renderToStaticMarkup(createElement(GoalReviewReminders, { person, userId: 'account', today: '2026-10-12' }));
  assert.match(html, /reminder-goal-review-iron/);
  assert.doesNotMatch(html, /reminder-goal-review-fat/);
  assert.match(html, /2020-01-01/);
  assert.match(html, /not a medical deadline/);
  assert.match(html, /No personal details are needed/);
  assert.match(html, /type="button"[^>]*data-testid="dismiss-goal-review-iron"/);
});

test('dismissal is persistent and isolated by account, person, nutrient, value and review date', () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } });
  try {
    const key = goalReviewDismissalKey('account', 101, 'iron', 18, '2020-01-01');
    assert.equal(readGoalReviewDismissal(key), false);
    assert.equal(saveGoalReviewDismissal(key), true);
    assert.equal(readGoalReviewDismissal(key), true);
    const html = renderToStaticMarkup(createElement(GoalReviewReminders, { person, userId: 'account', today: '2026-10-12' }));
    assert.equal(html, '');
    for (const changed of [
      goalReviewDismissalKey('other', 101, 'iron', 18, '2020-01-01'),
      goalReviewDismissalKey('account', 102, 'iron', 18, '2020-01-01'),
      goalReviewDismissalKey('account', 101, 'fat', 18, '2020-01-01'),
      goalReviewDismissalKey('account', 101, 'iron', 20, '2020-01-01'),
      goalReviewDismissalKey('account', 101, 'iron', 18, '2021-01-01'),
    ]) assert.equal(readGoalReviewDismissal(changed), false);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      get localStorage() { throw new Error('Storage blocked'); },
    } });
    assert.equal(readGoalReviewDismissal(key), false);
    assert.equal(saveGoalReviewDismissal(key), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

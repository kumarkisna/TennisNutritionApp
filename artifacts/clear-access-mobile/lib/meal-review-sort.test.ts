// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { filterMealReviews, sortMealReviews } from './meal-review-sort';
import type { MealPlanReview } from './local-models';

const review = (date: string, rating: number): MealPlanReview => ({
  personId: 1, date, rating, keyword: `rating ${rating}`, note: '',
});

test('meal history can sort ratings high-to-low, using newest date for ties', () => {
  const input = [review('2026-01-01', 8), review('2026-01-03', 10), review('2026-01-02', 8)];
  assert.deepEqual(sortMealReviews(input, 'rating').map(item => item.date), ['2026-01-03', '2026-01-02', '2026-01-01']);
  assert.deepEqual(input.map(item => item.date), ['2026-01-01', '2026-01-03', '2026-01-02']);
});

test('recent sort orders saved reviews by newest date first', () => {
  const input = [review('2026-01-01', 10), review('2026-01-03', 1), review('2026-01-02', 5)];
  assert.deepEqual(sortMealReviews(input, 'recent').map(item => item.date), ['2026-01-03', '2026-01-02', '2026-01-01']);
});

test('meal history search matches keyword or note and combines with minimum rating', () => {
  const reviews = [
    { ...review('2026-01-01', 8), keyword: 'quick breakfast', note: 'felt energized' },
    { ...review('2026-01-02', 9), keyword: 'match day', note: 'quick snack worked' },
    { ...review('2026-01-03', 7), keyword: 'rest day', note: 'felt tired' },
  ];
  assert.deepEqual(filterMealReviews(reviews, '  QUICK  ').map(item => item.date), ['2026-01-01', '2026-01-02']);
  assert.deepEqual(filterMealReviews(reviews, 'energized').map(item => item.date), ['2026-01-01']);
  assert.deepEqual(filterMealReviews(reviews, 'quick', 9).map(item => item.date), ['2026-01-02']);
  assert.deepEqual(filterMealReviews(reviews, '', 9).map(item => item.date), ['2026-01-02']);
  assert.equal(filterMealReviews(reviews, '').length, 3);
  assert.equal(reviews.length, 3);
});

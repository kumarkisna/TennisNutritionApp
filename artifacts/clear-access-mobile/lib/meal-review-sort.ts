import type { MealPlanReview } from './local-models';

export type MealReviewSort = 'recent' | 'rating';

export function filterMealReviews(reviews: MealPlanReview[], search: string): MealPlanReview[] {
  const query = search.trim().toLocaleLowerCase();
  return reviews.filter(item =>
    !query || item.keyword.toLocaleLowerCase().includes(query) || item.note.toLocaleLowerCase().includes(query));
}

export function sortMealReviews(reviews: MealPlanReview[], sort: MealReviewSort): MealPlanReview[] {
  return [...reviews].sort((a, b) => sort === 'rating'
    ? b.rating - a.rating || b.date.localeCompare(a.date)
    : b.date.localeCompare(a.date));
}

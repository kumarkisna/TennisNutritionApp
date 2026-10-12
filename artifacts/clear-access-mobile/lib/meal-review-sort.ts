import type { MealPlanReview } from './local-models';

export type MealReviewSort = 'recent' | 'rating';
export type MealReviewDateRange = { startDate: string; endDate: string };

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function mealReviewDateRangeError(startDate: string, endDate: string): string | null {
  const start = startDate.trim();
  const end = endDate.trim();
  if (start && !isRealDate(start)) return 'Enter a real start date in YYYY-MM-DD format.';
  if (end && !isRealDate(end)) return 'Enter a real end date in YYYY-MM-DD format.';
  if (start && end && start > end) return 'Start date must be on or before end date.';
  return null;
}

export function filterMealReviews(
  reviews: MealPlanReview[],
  search: string,
  minimumRating: number | null = null,
  dateRange: MealReviewDateRange = { startDate: '', endDate: '' },
): MealPlanReview[] {
  const query = search.trim().toLocaleLowerCase();
  const startDate = dateRange.startDate.trim();
  const endDate = dateRange.endDate.trim();
  if (mealReviewDateRangeError(startDate, endDate)) return [];
  return reviews.filter(item =>
    (minimumRating === null || item.rating >= minimumRating) &&
    (!startDate || item.date >= startDate) &&
    (!endDate || item.date <= endDate) &&
    (!query || item.keyword.toLocaleLowerCase().includes(query) || item.note.toLocaleLowerCase().includes(query)));
}

export function sortMealReviews(reviews: MealPlanReview[], sort: MealReviewSort): MealPlanReview[] {
  return [...reviews].sort((a, b) => sort === 'rating'
    ? b.rating - a.rating || b.date.localeCompare(a.date)
    : b.date.localeCompare(a.date));
}

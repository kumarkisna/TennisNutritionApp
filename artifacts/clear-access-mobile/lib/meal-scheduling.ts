import type { MealTimes } from './local-models';
import { isClockTime } from './tennis-planning';

// Suggestions, not medically prescribed times. Clock times belong to the selected day.
export const DEFAULT_MEAL_TIMES: Readonly<MealTimes> = Object.freeze({
  breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00',
});
export function getMealTimes(times?: MealTimes): MealTimes {
  return { ...(times ?? DEFAULT_MEAL_TIMES) };
}
export function isMealTimes(value: unknown): value is MealTimes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const times = value as Record<string, unknown>;
  const meals = Object.keys(DEFAULT_MEAL_TIMES);
  return Object.keys(times).length === meals.length && meals.every(meal => Object.hasOwn(times, meal) && isClockTime(times[meal]));
}
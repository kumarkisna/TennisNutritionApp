import type { MealEntry, TennisPlan } from './local-models';

/** Both the preview and atomic copy use the same canonical, device-local snapshot. */
export function getTennisFoodPlanFingerprint(plan: TennisPlan, entries: MealEntry[], personName: string): string {
  const ids = new Set(plan.diets?.map(diet => diet.id));
  const foods = entries.filter(entry => entry.tennisDietId && ids.has(entry.tennisDietId))
    .sort((a, b) => a.id - b.id)
    .map(entry => ({
      id: entry.id, slot: entry.tennisDietId, meal: entry.meal, grams: entry.grams,
      food: entry.food,
    }));
  return JSON.stringify({ personName, plan, foods });
}
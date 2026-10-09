import type { FoodIngredient } from './local-models';

export const MAX_FOOD_INGREDIENTS = 50;

export type FoodIngredientDraft = {
  key: string;
  name: string;
  grams: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  fiberPer100g: string;
  calciumMgPer100g: string;
  ironMgPer100g: string;
};

export type FoodNutritionPer100g = Omit<FoodIngredient, 'name' | 'grams'>;

export type ParsedFoodIngredients =
  | { ok: true; ingredients: FoodIngredient[] }
  | { ok: false; error: string };

const ingredientKeys = [
  'name',
  'grams',
  'caloriesPer100g',
  'proteinPer100g',
  'carbsPer100g',
  'fatPer100g',
  'fiberPer100g',
  'calciumMgPer100g',
  'ironMgPer100g',
].sort();

export function isFoodIngredient(value: unknown): value is FoodIngredient {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== ingredientKeys.length || keys.some((key, index) => key !== ingredientKeys[index])) return false;
  return typeof record.name === 'string' &&
    !!record.name.trim() &&
    record.name.length <= 120 &&
    typeof record.grams === 'number' &&
    Number.isFinite(record.grams) &&
    record.grams >= 0.1 &&
    record.grams <= 100_000 &&
    isFiniteInRange(record.caloriesPer100g, 0, 1000) &&
    isFiniteInRange(record.proteinPer100g, 0, 100) &&
    isFiniteInRange(record.carbsPer100g, 0, 100) &&
    isFiniteInRange(record.fatPer100g, 0, 100) &&
    isFiniteInRange(record.fiberPer100g, 0, 100) &&
    (record.calciumMgPer100g === null || isFiniteInRange(record.calciumMgPer100g, 0, 10_000)) &&
    (record.ironMgPer100g === null || isFiniteInRange(record.ironMgPer100g, 0, 1000));
}

export function isFoodIngredientList(value: unknown): value is FoodIngredient[] {
  return Array.isArray(value) &&
    value.length <= MAX_FOOD_INGREDIENTS &&
    value.every(isFoodIngredient);
}

export function createEmptyFoodIngredientDraft(key: string): FoodIngredientDraft {
  return {
    key,
    name: '',
    grams: '',
    caloriesPer100g: '',
    proteinPer100g: '',
    carbsPer100g: '',
    fatPer100g: '',
    fiberPer100g: '',
    calciumMgPer100g: '',
    ironMgPer100g: '',
  };
}

export function foodIngredientToDraft(ingredient: FoodIngredient, key: string): FoodIngredientDraft {
  return {
    key,
    name: ingredient.name,
    grams: String(ingredient.grams),
    caloriesPer100g: String(ingredient.caloriesPer100g),
    proteinPer100g: String(ingredient.proteinPer100g),
    carbsPer100g: String(ingredient.carbsPer100g),
    fatPer100g: String(ingredient.fatPer100g),
    fiberPer100g: String(ingredient.fiberPer100g),
    calciumMgPer100g: ingredient.calciumMgPer100g === null ? '' : String(ingredient.calciumMgPer100g),
    ironMgPer100g: ingredient.ironMgPer100g === null ? '' : String(ingredient.ironMgPer100g),
  };
}

function parseNumber(raw: string, min: number, max: number): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

export function parseFoodIngredientDrafts(drafts: FoodIngredientDraft[]): ParsedFoodIngredients {
  if (drafts.length === 0) return { ok: false, error: 'Add at least one ingredient or enter nutrition manually.' };
  if (drafts.length > MAX_FOOD_INGREDIENTS) {
    return { ok: false, error: `A custom food can have up to ${MAX_FOOD_INGREDIENTS} ingredients.` };
  }

  const ingredients: FoodIngredient[] = [];
  for (const [index, draft] of drafts.entries()) {
    const label = `Ingredient ${index + 1}`;
    const name = draft.name.trim();
    if (!name || name.length > 120) {
      return { ok: false, error: `${label}: enter a name up to 120 characters.` };
    }
    const grams = parseNumber(draft.grams, 0.1, 100_000);
    if (grams === undefined) return { ok: false, error: `${label}: enter an amount from 0.1 to 100,000 g.` };

    const caloriesPer100g = parseNumber(draft.caloriesPer100g, 0, 1000);
    if (caloriesPer100g === undefined) return { ok: false, error: `${label}: calories per 100 g must be 0 to 1,000 kcal.` };
    const proteinPer100g = parseNumber(draft.proteinPer100g, 0, 100);
    if (proteinPer100g === undefined) return { ok: false, error: `${label}: protein per 100 g must be 0 to 100 g.` };
    const carbsPer100g = parseNumber(draft.carbsPer100g, 0, 100);
    if (carbsPer100g === undefined) return { ok: false, error: `${label}: carbohydrates per 100 g must be 0 to 100 g.` };
    const fatPer100g = parseNumber(draft.fatPer100g, 0, 100);
    if (fatPer100g === undefined) return { ok: false, error: `${label}: fat per 100 g must be 0 to 100 g.` };
    const fiberPer100g = parseNumber(draft.fiberPer100g, 0, 100);
    if (fiberPer100g === undefined) return { ok: false, error: `${label}: fiber per 100 g must be 0 to 100 g.` };

    const calciumMgPer100g = draft.calciumMgPer100g.trim()
      ? parseNumber(draft.calciumMgPer100g, 0, 10_000)
      : null;
    if (calciumMgPer100g === undefined) return { ok: false, error: `${label}: calcium per 100 g must be 0 to 10,000 mg, or blank if unknown.` };

    const ironMgPer100g = draft.ironMgPer100g.trim()
      ? parseNumber(draft.ironMgPer100g, 0, 1000)
      : null;
    if (ironMgPer100g === undefined) return { ok: false, error: `${label}: iron per 100 g must be 0 to 1,000 mg, or blank if unknown.` };

    ingredients.push({
      name,
      grams,
      caloriesPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      fiberPer100g,
      calciumMgPer100g,
      ironMgPer100g,
    });
  }
  return { ok: true, ingredients };
}

export function calculateFoodNutrition(ingredients: FoodIngredient[]): FoodNutritionPer100g | null {
  if (!isFoodIngredientList(ingredients) || ingredients.length === 0) return null;
  const totalGrams = ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0);
  if (!Number.isFinite(totalGrams) || totalGrams <= 0) return null;

  const average = (key: keyof FoodNutritionPer100g): number | null => {
    const values = ingredients.map(ingredient => ingredient[key]);
    if (values.some(value => value === null)) return null;
    const weightedTotal = ingredients.reduce(
      (sum, ingredient) => sum + ingredient.grams * (ingredient[key] as number),
      0,
    );
    const result = weightedTotal / totalGrams;
    return Number.isFinite(result) ? Math.round(result * 10) / 10 : null;
  };

  return {
    caloriesPer100g: average('caloriesPer100g')!,
    proteinPer100g: average('proteinPer100g')!,
    carbsPer100g: average('carbsPer100g')!,
    fatPer100g: average('fatPer100g')!,
    fiberPer100g: average('fiberPer100g')!,
    calciumMgPer100g: average('calciumMgPer100g'),
    ironMgPer100g: average('ironMgPer100g'),
  };
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

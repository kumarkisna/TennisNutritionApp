import { FoodCategory, type FoodCategory as FoodCategoryType } from './local-models';
import type { FoodNutritionPer100g } from './food-nutrition';

export type BarcodeFoodData = {
  name: string;
  brand: string;
  category: FoodCategoryType;
  nutrition: BarcodeNutrition;
  missingRequired: string[];
};

export type BarcodeNutrition = Omit<FoodNutritionPer100g, 'caloriesPer100g' | 'proteinPer100g' | 'carbsPer100g' | 'fatPer100g' | 'fiberPer100g'> & {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(nutrients: Record<string, unknown>, key: string): number | null {
  const value = nutrients[key];
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function categoryFor(tags: unknown): FoodCategoryType {
  const text = Array.isArray(tags) ? tags.filter(item => typeof item === 'string').join(' ').toLowerCase() : '';
  if (/en:(cereals|grains|breads|pastas|rices)|en:(céréales|pain)/.test(text)) return FoodCategory.grains;
  if (/en:(meats|fish|eggs|legumes|proteins)|en:(viandes|poissons)/.test(text)) return FoodCategory.protein;
  if (/en:vegetables|en:légumes/.test(text)) return FoodCategory.vegetables;
  if (/en:fruit/.test(text)) return FoodCategory.fruit;
  if (/en:(dairies|milks|cheeses|yogurts)|en:(produits-laitiers)/.test(text)) return FoodCategory.dairy;
  return FoodCategory.other;
}

export function parseOpenFoodFactsProduct(payload: unknown): BarcodeFoodData | null {
  if (!record(payload) || payload.status !== 1 || !record(payload.product)) return null;
  const product = payload.product;
  const name = [product.product_name, product.product_name_en, product.generic_name]
    .find(value => typeof value === 'string' && value.trim().length > 0);
  if (typeof name !== 'string') return null;
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';
  const nutrients = record(product.nutriments) ? product.nutriments : {};
  const nutrition: BarcodeNutrition = {
    caloriesPer100g: readNumber(nutrients, 'energy-kcal_100g'),
    proteinPer100g: readNumber(nutrients, 'proteins_100g'),
    carbsPer100g: readNumber(nutrients, 'carbohydrates_100g'),
    fatPer100g: readNumber(nutrients, 'fat_100g'),
    fiberPer100g: readNumber(nutrients, 'fiber_100g'),
    calciumMgPer100g: readNumber(nutrients, 'calcium_100g'),
    ironMgPer100g: readNumber(nutrients, 'iron_100g'),
  };
  const required: (keyof FoodNutritionPer100g)[] = [
    'caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'fiberPer100g',
  ];
  const labels: Record<string, string> = {
    caloriesPer100g: 'calories', proteinPer100g: 'protein', carbsPer100g: 'carbohydrates',
    fatPer100g: 'fat', fiberPer100g: 'fiber',
  };
  return {
    name: name.trim(),
    brand,
    category: categoryFor(product.categories_tags),
    nutrition,
    missingRequired: required.filter(key => nutrition[key] === null).map(key => labels[key]),
  };
}

import { db, foodsTable, mealEntriesTable, type Food, type MealEntry, type Preferences } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export const activityMultipliers = {
  sedentary: 1,
  light: 1.1,
  moderate: 1.2,
  very_active: 1.35,
} as const;

export type ActivityLevel = keyof typeof activityMultipliers;

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calciumMg: number | null;
  ironMg: number | null;
};

export const meals = ["breakfast", "lunch", "dinner", "snack"] as const;

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function effectiveMinerals(food: Food) {
  return {
    calciumMgPer100g: food.calciumCorrectionEnabled ? food.calciumCorrectionMgPer100g : food.calciumMgPer100g,
    ironMgPer100g: food.ironCorrectionEnabled ? food.ironCorrectionMgPer100g : food.ironMgPer100g,
  };
}

export function toFood(food: Food) {
  const imported = food.referenceKey?.startsWith("off:") ?? false;
  const sourceUrl = imported
    ? `https://world.openfoodfacts.org/product/${food.referenceKey!.split(":").at(-1)}`
    : undefined;
  return {
    id: food.id,
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    category: food.category,
    source: imported ? "open_food_facts" : food.ownerId === null ? "reference" : "custom",
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    carbsPer100g: food.carbsPer100g,
    fatPer100g: food.fatPer100g,
    fiberPer100g: food.fiberPer100g,
    fiberKnown: food.fiberKnown,
    ...effectiveMinerals(food),
    supplierCalciumMgPer100g: food.calciumMgPer100g,
    supplierIronMgPer100g: food.ironMgPer100g,
    calciumCorrectionEnabled: food.calciumCorrectionEnabled,
    ironCorrectionEnabled: food.ironCorrectionEnabled,
    mineralCorrectionNote: food.mineralCorrectionNote,
  };
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function nutritionFor(food: Food, grams: number): Nutrition {
  const portion = grams / 100;
  const minerals = effectiveMinerals(food);
  return {
    calories: round1(food.caloriesPer100g * portion),
    protein: round1(food.proteinPer100g * portion),
    carbs: round1(food.carbsPer100g * portion),
    fat: round1(food.fatPer100g * portion),
    fiber: round1(food.fiberPer100g * portion),
    calciumMg: minerals.calciumMgPer100g === null ? null : round1(minerals.calciumMgPer100g * portion),
    ironMg: minerals.ironMgPer100g === null ? null : round1(minerals.ironMgPer100g * portion),
  };
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  // A partial micronutrient sum must never be mistaken for the day's complete intake.
  const sumKnown = (key: "calciumMg" | "ironMg") =>
    items.some((item) => item[key] === null)
      ? null
      : round1(items.reduce((sum, item) => sum + (item[key] ?? 0), 0));
  return {
    calories: round1(items.reduce((sum, item) => sum + item.calories, 0)),
    protein: round1(items.reduce((sum, item) => sum + item.protein, 0)),
    carbs: round1(items.reduce((sum, item) => sum + item.carbs, 0)),
    fat: round1(items.reduce((sum, item) => sum + item.fat, 0)),
    fiber: round1(items.reduce((sum, item) => sum + item.fiber, 0)),
    calciumMg: sumKnown("calciumMg"),
    ironMg: sumKnown("ironMg"),
  };
}

export function toMealEntry(entry: MealEntry, food: Food) {
  if (entry.personId === null) {
    throw new Error("A legacy meal entry has not been assigned to a person.");
  }
  return {
    id: entry.id,
    date: entry.plannedDate,
    personId: entry.personId,
    meal: entry.meal,
    grams: entry.grams,
    food: toFood(food),
    nutrition: nutritionFor(food, entry.grams),
  };
}

export function toPreferences(preferences?: Pick<Preferences, "activityLevel" | "baselineCalories">) {
  const activityLevel = (preferences?.activityLevel ?? "sedentary") as ActivityLevel;
  const activityMultiplier = activityMultipliers[activityLevel];
  if (activityMultiplier === undefined) {
    throw new Error("Unsupported activity level in planner preferences");
  }
  const baselineCalories = preferences?.baselineCalories ?? 2000;
  return {
    activityLevel,
    baselineCalories,
    activityMultiplier,
    targetCalories: Math.round(baselineCalories * activityMultiplier),
  };
}

export async function loadEntriesForDate(userId: string, date: string, personId: number) {
  return db
    .select({ entry: mealEntriesTable, food: foodsTable })
    .from(mealEntriesTable)
    .innerJoin(foodsTable, eq(mealEntriesTable.foodId, foodsTable.id))
    .where(
      and(
        eq(mealEntriesTable.ownerId, userId),
        eq(mealEntriesTable.personId, personId),
        eq(mealEntriesTable.plannedDate, date),
      ),
    )
    .orderBy(mealEntriesTable.id);
}
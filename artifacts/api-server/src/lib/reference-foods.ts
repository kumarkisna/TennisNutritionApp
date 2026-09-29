import { db, foodsTable, type InsertFood } from "@workspace/db";

const referenceFoods: InsertFood[] = [
  { referenceKey: "oats-dry", name: "Oats, dry", category: "grains", caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9, fiberPer100g: 10.6 },
  { referenceKey: "rice-white-cooked", name: "White rice, cooked", category: "grains", caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28.2, fatPer100g: 0.3, fiberPer100g: 0.4 },
  { referenceKey: "rice-brown-cooked", name: "Brown rice, cooked", category: "grains", caloriesPer100g: 123, proteinPer100g: 2.7, carbsPer100g: 25.6, fatPer100g: 1, fiberPer100g: 1.6 },
  { referenceKey: "bread-whole-wheat", name: "Whole wheat bread", category: "grains", caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 4.2, fiberPer100g: 7 },
  { referenceKey: "egg-whole", name: "Egg, whole", category: "protein", caloriesPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5, fiberPer100g: 0 },
  { referenceKey: "chicken-breast-cooked", name: "Chicken breast, cooked", category: "protein", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0 },
  { referenceKey: "salmon-cooked", name: "Salmon, cooked", category: "protein", caloriesPer100g: 206, proteinPer100g: 22.1, carbsPer100g: 0, fatPer100g: 12.4, fiberPer100g: 0 },
  { referenceKey: "tofu-firm", name: "Tofu, firm", category: "protein", caloriesPer100g: 144, proteinPer100g: 17.3, carbsPer100g: 2.8, fatPer100g: 8.7, fiberPer100g: 2.3 },
  { referenceKey: "lentils-cooked", name: "Lentils, cooked", category: "protein", caloriesPer100g: 116, proteinPer100g: 9, carbsPer100g: 20.1, fatPer100g: 0.4, fiberPer100g: 7.9 },
  { referenceKey: "chickpeas-cooked", name: "Chickpeas, cooked", category: "protein", caloriesPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6, fiberPer100g: 7.6 },
  { referenceKey: "banana", name: "Banana", category: "fruit", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3, fiberPer100g: 2.6 },
  { referenceKey: "apple", name: "Apple", category: "fruit", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 13.8, fatPer100g: 0.2, fiberPer100g: 2.4 },
  { referenceKey: "blueberries", name: "Blueberries", category: "fruit", caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14.5, fatPer100g: 0.3, fiberPer100g: 2.4 },
  { referenceKey: "broccoli-cooked", name: "Broccoli, cooked", category: "vegetables", caloriesPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7.2, fatPer100g: 0.4, fiberPer100g: 3.3 },
  { referenceKey: "spinach-raw", name: "Spinach, raw", category: "vegetables", caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 2.2 },
  { referenceKey: "carrots-raw", name: "Carrots, raw", category: "vegetables", caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, fiberPer100g: 2.8 },
  { referenceKey: "sweet-potato-baked", name: "Sweet potato, baked", category: "vegetables", caloriesPer100g: 90, proteinPer100g: 2, carbsPer100g: 20.7, fatPer100g: 0.2, fiberPer100g: 3.3 },
  { referenceKey: "yogurt-greek-plain", name: "Greek yogurt, plain nonfat", category: "dairy", caloriesPer100g: 59, proteinPer100g: 10.3, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 0 },
  { referenceKey: "milk-whole", name: "Milk, whole", category: "dairy", caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, fiberPer100g: 0 },
  { referenceKey: "almonds", name: "Almonds", category: "other", caloriesPer100g: 579, proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9, fiberPer100g: 12.5 },
  { referenceKey: "peanut-butter", name: "Peanut butter", category: "other", caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, fiberPer100g: 6 },
  { referenceKey: "olive-oil", name: "Olive oil", category: "other", caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, fiberPer100g: 0 },
  { referenceKey: "avocado", name: "Avocado", category: "fruit", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7, fiberPer100g: 6.7 },
];

export async function seedReferenceFoods(): Promise<void> {
  await db.insert(foodsTable).values(referenceFoods).onConflictDoNothing({
    target: foodsTable.referenceKey,
  });
}
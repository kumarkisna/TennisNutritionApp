// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { parseOpenFoodFactsProduct } from './food-barcode';

test('barcode product parser fills per-100 g nutrition and categorizes common foods', () => {
  const result = parseOpenFoodFactsProduct({
    status: 1,
    product: {
      product_name: 'Rolled oats',
      brands: 'Grain Co, Other Brand',
      categories_tags: ['en:cereals', 'en:breakfasts'],
      nutriments: {
        'energy-kcal_100g': 380, proteins_100g: 13.2, carbohydrates_100g: 67,
        fat_100g: 6.5, fiber_100g: 10, calcium_100g: 52, iron_100g: 4.2,
      },
    },
  });
  assert.equal(result?.name, 'Rolled oats');
  assert.equal(result?.brand, 'Grain Co');
  assert.equal(result?.category, 'grains');
  assert.equal(result?.nutrition.caloriesPer100g, 380);
  assert.deepEqual(result?.missingRequired, []);
});

test('unknown barcode and incomplete data are handled without inventing nutrient values', () => {
  assert.equal(parseOpenFoodFactsProduct({ status: 0 }), null);
  const result = parseOpenFoodFactsProduct({ status: 1, product: { product_name: 'Test food', nutriments: { proteins_100g: 3 } } });
  assert.equal(result?.nutrition.proteinPer100g, 3);
  assert.equal(result?.nutrition.caloriesPer100g, null);
  assert.equal(result?.nutrition.calciumMgPer100g, null);
  assert.deepEqual(result?.missingRequired, ['calories', 'carbohydrates', 'fat', 'fiber']);
});

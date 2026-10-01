// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import { getPlanningTargets } from './planning-targets';

const person = { targetCalories: 2400, weightKg: 70, fatGoalG: 60 };

test('planning targets show all four nutrients using existing references and personal goals', () => {
  const targets = getPlanningTargets(person, 'training_60');
  assert.match(targets.calories, /2.?400 kcal \/ day/);
  assert.equal(targets.protein, '56–70 g / day');
  assert.equal(targets.carbs, '350–420 g / day');
  assert.equal(targets.fat, '60 g / day');
});
test('strength activity uses strength protein and does not invent carbohydrate targets', () => {
  const targets = getPlanningTargets(person, 'strength');
  assert.equal(targets.protein, '112–119 g / day');
  assert.equal(targets.carbs, 'Not specified in workbook');
});
test('unset body weight and fat goal are explicit, not zero-valued targets', () => {
  const targets = getPlanningTargets({ ...person, weightKg: null, fatGoalG: null }, 'endurance');
  assert.equal(targets.protein, 'Add body weight to calculate');
  assert.equal(targets.carbs, 'Add body weight to calculate');
  assert.equal(targets.fat, 'No personal goal set');
});
test('rest and extreme references preserve missing and single-value carbohydrate ranges', () => {
  assert.equal(getPlanningTargets(person, 'rest').carbs, 'Not specified in workbook');
  assert.equal(getPlanningTargets(person, 'extreme').carbs, '700 g / day');
});
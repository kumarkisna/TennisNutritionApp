// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import { activityCaloriesPerKg, calculatePlanningEstimates, getPlanningTargets } from './planning-targets';

const person = {
  targetCalories: 2400,
  baselineCalories: 1800,
  activityMultiplier: 1.2,
  weightKg: 70,
  ageYears: 30,
  dateOfBirth: null,
  fatGoalG: 60,
};
const date = '2025-06-15';

test('app-chosen kcal/kg activity heuristics and 30% energy fat formula are used', () => {
  const coefficients = {
    rest: 30,
    low_intensity: 35,
    training_60: 40,
    training_120: 50,
    endurance: 60,
    extreme: 70,
    strength: 45,
  } as const;
  assert.deepEqual(activityCaloriesPerKg, coefficients);
  for (const [activity, kcalPerKg] of Object.entries(coefficients) as [keyof typeof coefficients, number][]) {
    const estimates = calculatePlanningEstimates(person, activity, date);
    const calories = Math.round(70 * kcalPerKg);
    assert.equal(estimates.calories, calories, `${activity} calories`);
    assert.equal(estimates.fat, calories * 0.30 / 9, `${activity} fat`);
    assert.equal(estimates.unavailableReason, null);
  }
});

test('estimates change with activity and saved body weight, not baseline or manual fat goal', () => {
  const rest = calculatePlanningEstimates(person, 'rest', date);
  const endurance = calculatePlanningEstimates(person, 'endurance', date);
  assert.notEqual(rest.calories, endurance.calories);
  const heavier = calculatePlanningEstimates({ ...person, weightKg: 80 }, 'rest', date);
  assert.equal(heavier.calories, 2400);
  assert.equal(heavier.fat, 80);
  const legacyPerson = { ...person, baselineCalories: 4500, targetCalories: 9999, fatGoalG: 1 };
  const legacyEstimate = calculatePlanningEstimates(legacyPerson, 'rest', date);
  assert.equal(legacyEstimate.calories, 2100);
  assert.equal(legacyEstimate.fat, 70);
});

test('DOB takes precedence and adult eligibility changes on the selected-date birthday', () => {
  const birthday = { ...person, ageYears: 50, dateOfBirth: '2007-06-16' };
  const beforeBirthday = calculatePlanningEstimates(birthday, 'rest', '2025-06-15');
  const onBirthday = calculatePlanningEstimates(birthday, 'rest', '2025-06-16');
  assert.equal(beforeBirthday.calories, null);
  assert.match(beforeBirthday.unavailableReason ?? '', /under 18/);
  assert.equal(onBirthday.calories, 2100);
  assert.equal(onBirthday.unavailableReason, null);
  const afterBirthday = calculatePlanningEstimates({ ...person, dateOfBirth: '2007-06-14', ageYears: 12 }, 'rest', date);
  assert.equal(afterBirthday.calories, 2100);
});

test('unknown age, missing weight, invalid date, and under-18 status never fall back to legacy targets', () => {
  const unknownAge = calculatePlanningEstimates({ ...person, ageYears: null }, 'rest', date);
  assert.equal(unknownAge.calories, null);
  assert.match(unknownAge.unavailableReason ?? '', /date of birth or age/);
  const minor = calculatePlanningEstimates({ ...person, ageYears: 17 }, 'rest', date);
  assert.equal(minor.fat, null);
  assert.match(minor.unavailableReason ?? '', /under 18/);
  const noWeight = calculatePlanningEstimates({ ...person, weightKg: null }, 'rest', date);
  assert.equal(noWeight.calories, null);
  assert.match(noWeight.unavailableReason ?? '', /body weight/);
  const invalidDate = calculatePlanningEstimates(person, 'rest', '2025-02-29');
  assert.equal(invalidDate.calories, null);
  assert.match(invalidDate.unavailableReason ?? '', /valid selected date/);
});

test('planning targets retain workbook ranges and identify the ISSN general-fitness carbohydrate gap', () => {
  const targets = getPlanningTargets(person, 'training_60', date);
  assert.match(targets.calories, /2.?800 kcal \/ day/);
  assert.equal(targets.protein, '56–70 g / day');
  assert.equal(targets.carbs, '350–420 g / day');
  assert.equal(targets.fat, '93.3 g / day');
  for (const activity of ['rest', 'low_intensity', 'strength'] as const) {
    assert.equal(getPlanningTargets(person, activity, date).carbs, '210–350 g / day (ISSN general-fitness reference)');
  }
  assert.equal(getPlanningTargets(person, 'endurance', date).carbs, '560–700 g / day');
  assert.match(getPlanningTargets(person, 'rest', date).carbs, /ISSN general-fitness reference/);
});

test('missing weight and age are stated explicitly for adult estimates and scaled references', () => {
  const targets = getPlanningTargets({ ...person, weightKg: null, ageYears: null, fatGoalG: null }, 'rest', date);
  assert.match(targets.calories, /Adult estimates are unavailable/);
  assert.match(targets.calories, /Body weight is also needed/);
  assert.equal(targets.protein, 'Add body weight to calculate');
  assert.equal(targets.carbs, 'Add body weight to calculate (ISSN general-fitness reference)');
  assert.match(targets.fat, /Adult estimates are unavailable/);
});
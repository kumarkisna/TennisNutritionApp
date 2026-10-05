// @ts-ignore Node test modules belong to the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules belong to the direct regression runner.
import test from 'node:test';
import type { MealEntry, TennisPlan } from './local-models';
import { buildPlannedDietHtml, sortPlannedDiet } from './print-plan';

const mealTimes = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00' };

function entry(id: number, meal: MealEntry['meal'], foodName: string, tennisDietId?: string): MealEntry {
  return {
    id, date: '2026-10-05', personId: 1, meal, grams: 125,
    ...(tennisDietId ? { tennisDietId } : {}),
    food: {
      id, name: foodName, category: 'fruit', source: 'custom',
      caloriesPer100g: 90, proteinPer100g: 1, carbsPer100g: 20, fatPer100g: 0,
      fiberPer100g: 2, fiberKnown: true, calciumMgPer100g: null, ironMgPer100g: null,
    },
    nutrition: { calories: 112.5, protein: 1.3, carbs: 25, fat: 0, fiber: 2.5, calciumMg: null, ironMg: null },
  };
}

test('planned foods sort by saved tennis-slot or meal time', () => {
  const items = sortPlannedDiet([
    entry(1, 'dinner', 'Dinner food'),
    entry(2, 'breakfast', 'Before-play food', 'diet-before'),
    entry(3, 'lunch', 'Lunch food'),
  ], mealTimes, [{ id: 'diet-before', phase: 'before', time: '07:15' }]);

  assert.deepEqual(items.map(item => [item.time, item.foodName, item.phase]), [
    ['07:15', 'Before-play food', 'before'],
    ['13:00', 'Lunch food', null],
    ['19:00', 'Dinner food', null],
  ]);
});

test('print HTML includes the person, date, portions, and safely escaped names', () => {
  const html = buildPlannedDietHtml({
    personName: 'A & <B>',
    date: '2026-10-05',
    activityType: 'training_120',
    entries: [entry(1, 'breakfast', 'Oats <fresh>')],
    mealTimes,
  });

  assert.match(html, /A &amp; &lt;B&gt;/);
  assert.match(html, /2026-10-05/);
  assert.match(html, /Oats &lt;fresh&gt;/);
  assert.match(html, /125 g/);
  assert.match(html, /08:00/);
  assert.match(html, /Training 60–120 minutes/);
  assert.match(html, /Tennis plan type<\/span><span class="value">Not set/);
  assert.match(html, /Plan experience<\/span><span class="value">Not rated/);
});

test('print HTML includes tennis plan type, sorted sessions, intensity, and rating', () => {
  const tennisPlan: TennisPlan = {
    mode: 'training',
    sessions: [
      { kind: 'gym', startTime: '15:00', durationMinutes: 45, intensity: 'light' },
      { kind: 'practice', startTime: '09:00', durationMinutes: 90, intensity: 'hard' },
    ],
    fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    experienceRating: 8,
  };
  const html = buildPlannedDietHtml({
    personName: 'Me',
    date: '2026-10-05',
    activityType: 'training_60',
    tennisPlan,
    entries: [],
    mealTimes,
  });

  assert.match(html, /Tennis plan type<\/span><span class="value">Training/);
  assert.match(html, /Plan experience<\/span><span class="value">8\/10/);
  assert.ok(html.indexOf('09:00') < html.indexOf('15:00'));
  assert.match(html, /Practice[\s\S]*1 h 30 min[\s\S]*Hard/);
  assert.match(html, /Gym[\s\S]*45 min[\s\S]*Light/);
});

test('empty plans print a clear empty state and missing linked slots fail explicitly', () => {
  const emptyHtml = buildPlannedDietHtml({
    personName: 'Me', date: '2026-10-05', activityType: 'rest', entries: [], mealTimes,
  });
  assert.match(emptyHtml, /No foods planned for this date/);
  assert.throws(
    () => sortPlannedDiet([entry(1, 'snack', 'Fuel', 'diet-missing')], mealTimes),
    /missing tennis time slot/i,
  );
});
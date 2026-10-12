// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import {
  createMealHistoryPreferences,
  DEFAULT_MEAL_HISTORY_PREFERENCES,
  MEAL_HISTORY_PREFERENCES_KEY,
  type MealHistoryPreferencesStorage,
} from './meal-history-preferences';

class MemoryStorage implements MealHistoryPreferencesStorage {
  values = new Map<string, string>();
  failWrite = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Device storage is unavailable');
    this.values.set(key, value);
  }
}

test('fresh meal history uses recent and any-rating defaults without writing storage', async () => {
  const storage = new MemoryStorage();
  assert.deepEqual(await createMealHistoryPreferences(storage).load(), DEFAULT_MEAL_HISTORY_PREFERENCES);
  assert.equal(storage.values.size, 0);
});

test('minimum rating and sort persist independently of search text and planner data', async () => {
  const storage = new MemoryStorage();
  const plannerBytes = '{"people":[{"id":1}],"mealReviews":[{"date":"2026-10-12"}]}';
  storage.values.set('clear-access-mobile:planner:v1', plannerBytes);
  const preferences = createMealHistoryPreferences(storage);
  await preferences.save({ minimumRating: 8, sort: 'rating' });
  assert.deepEqual(await preferences.load(), { minimumRating: 8, sort: 'rating' });
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), plannerBytes);
  assert.equal(JSON.stringify([...storage.values.entries()]), JSON.stringify([
    ['clear-access-mobile:planner:v1', plannerBytes],
    [MEAL_HISTORY_PREFERENCES_KEY, '{"version":1,"minimumRating":8,"sort":"rating"}'],
  ]));
});

test('invalid saved filters fail explicitly without rewriting stored bytes', async () => {
  const storage = new MemoryStorage();
  const preferences = createMealHistoryPreferences(storage);
  for (const serialized of [
    'broken JSON',
    'null',
    '{"version":1,"minimumRating":0,"sort":"recent"}',
    '{"version":1,"minimumRating":5,"sort":"oldest"}',
  ]) {
    storage.values.set(MEAL_HISTORY_PREFERENCES_KEY, serialized);
    await assert.rejects(preferences.load(), /meal-history filters/i);
    assert.equal(storage.values.get(MEAL_HISTORY_PREFERENCES_KEY), serialized);
  }
  await assert.rejects(preferences.save({ minimumRating: 11, sort: 'recent' }), /minimum rating/i);
});

// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import {
  createMealHistoryPreferences,
  DEFAULT_MEAL_HISTORY_PREFERENCES,
  DEFAULT_MEAL_HISTORY_PREFERENCES_STATE,
  LEGACY_MEAL_HISTORY_PREFERENCES_KEY,
  MEAL_HISTORY_PREFERENCES_KEY,
  mealHistoryPreferencesForPerson,
  updateMealHistoryPreferencesForPerson,
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
  assert.deepEqual(await createMealHistoryPreferences(storage).load(), DEFAULT_MEAL_HISTORY_PREFERENCES_STATE);
  assert.equal(storage.values.size, 0);
});

test('minimum rating and sort persist independently for each person without changing planner data', async () => {
  const storage = new MemoryStorage();
  const plannerBytes = '{"people":[{"id":1}],"mealReviews":[{"date":"2026-10-12"}]}';
  storage.values.set('clear-access-mobile:planner:v1', plannerBytes);
  const preferences = createMealHistoryPreferences(storage);
  let state = await preferences.load();
  state = updateMealHistoryPreferencesForPerson(state, 1, { minimumRating: 8 });
  state = updateMealHistoryPreferencesForPerson(state, 1, { sort: 'rating' });
  state = updateMealHistoryPreferencesForPerson(state, 2, { minimumRating: 4 });
  await preferences.save(state);
  const loaded = await preferences.load();
  assert.deepEqual(mealHistoryPreferencesForPerson(loaded, 1), { minimumRating: 8, sort: 'rating' });
  assert.deepEqual(mealHistoryPreferencesForPerson(loaded, 2), { minimumRating: 4, sort: 'recent' });
  assert.deepEqual(mealHistoryPreferencesForPerson(loaded, 3), DEFAULT_MEAL_HISTORY_PREFERENCES);
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), plannerBytes);
  assert.equal(JSON.stringify([...storage.values.entries()]), JSON.stringify([
    ['clear-access-mobile:planner:v1', plannerBytes],
    [MEAL_HISTORY_PREFERENCES_KEY, '{"version":2,"byPerson":{"1":{"minimumRating":8,"sort":"rating"},"2":{"minimumRating":4,"sort":"recent"}},"legacyDefault":null}'],
  ]));
});

test('legacy shared filters migrate as a default without overwriting the old value', async () => {
  const storage = new MemoryStorage();
  const legacy = '{"version":1,"minimumRating":8,"sort":"rating"}';
  storage.values.set(LEGACY_MEAL_HISTORY_PREFERENCES_KEY, legacy);
  const preferences = createMealHistoryPreferences(storage);
  const loaded = await preferences.load();
  assert.deepEqual(loaded, { byPerson: {}, legacyDefault: { minimumRating: 8, sort: 'rating' } });
  assert.deepEqual(mealHistoryPreferencesForPerson(loaded, 1), { minimumRating: 8, sort: 'rating' });
  const withPersonOverride = updateMealHistoryPreferencesForPerson(loaded, 2, { minimumRating: 4 });
  await preferences.save(withPersonOverride);
  const restored = await preferences.load();
  assert.deepEqual(mealHistoryPreferencesForPerson(restored, 1), { minimumRating: 8, sort: 'rating' });
  assert.deepEqual(mealHistoryPreferencesForPerson(restored, 2), { minimumRating: 4, sort: 'rating' });
  assert.equal(storage.values.get(LEGACY_MEAL_HISTORY_PREFERENCES_KEY), legacy);
});

test('invalid saved filters fail explicitly without rewriting stored bytes', async () => {
  const storage = new MemoryStorage();
  const preferences = createMealHistoryPreferences(storage);
  for (const serialized of [
    'broken JSON',
    'null',
    '{"version":2,"byPerson":[],"legacyDefault":null}',
    '{"version":2,"byPerson":{"0":{"minimumRating":5,"sort":"recent"}},"legacyDefault":null}',
    '{"version":2,"byPerson":{"1":{"minimumRating":11,"sort":"recent"}},"legacyDefault":null}',
  ]) {
    storage.values.set(MEAL_HISTORY_PREFERENCES_KEY, serialized);
    await assert.rejects(preferences.load(), /meal-history filters/i);
    assert.equal(storage.values.get(MEAL_HISTORY_PREFERENCES_KEY), serialized);
  }
  await assert.rejects(preferences.save({
    byPerson: { '1': { minimumRating: 11, sort: 'recent' } },
    legacyDefault: null,
  }), /valid per-person/i);
});

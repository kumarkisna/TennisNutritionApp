// @ts-ignore Standalone Node regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Standalone Node regression runner.
import test from 'node:test';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { DEFAULT_MEAL_TIMES, getMealTimes, isMealTimes } from './meal-scheduling';
import { emptyTennisPlan } from './tennis-planning';
import type { Meal } from './local-models';

class MemoryStorage {
  values = new Map<string, string>();
  fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.fail) throw new Error('injected failure');
    this.values.set(key, value);
  }
}
const date = '2026-10-04', personId = 1;

test('all four meals have suggested times before any foods or tennis plan exist', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  const day = await store.getDayActivity({ date, personId });
  assert.deepEqual(getMealTimes(day.mealTimes), { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00' });
  assert.equal(isMealTimes(DEFAULT_MEAL_TIMES), true);
  const copy = getMealTimes(); copy.breakfast = '10:00';
  assert.equal(DEFAULT_MEAL_TIMES.breakfast, '08:00');
  assert.equal((await store.listMealEntries({ date, personId })).length, 0);
});

test('the first portion durably assigns defaults and time edits preserve food and totals', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  const food = (await store.listFoods())[0];
  const entry = await store.createMealEntry({ date, personId, meal: 'breakfast', foodId: food.id, grams: 100 });
  assert.deepEqual((await store.getDayActivity({ date, personId })).mealTimes, DEFAULT_MEAL_TIMES);
  const before = await store.getDailySummary({ date, personId });
  for (const [meal, time] of [['breakfast', '09:15'], ['lunch', '14:00'], ['dinner', '20:30'], ['snack', '17:00']] as const) {
    await store.saveMealTime({ date, personId, meal, time });
  }
  assert.deepEqual((await store.getDayActivity({ date, personId })).mealTimes, { breakfast: '09:15', lunch: '14:00', dinner: '20:30', snack: '17:00' });
  assert.deepEqual(await store.listMealEntries({ date, personId }), [entry]);
  assert.deepEqual(await store.getDailySummary({ date, personId }), before);
  const reloaded = createLocalStore(storage);
  assert.deepEqual(await reloaded.getDayActivity({ date, personId }), await store.getDayActivity({ date, personId }));
  await store.saveMealTime({ date, personId, meal: 'breakfast', time: DEFAULT_MEAL_TIMES.breakfast });
  assert.equal((await store.getDayActivity({ date, personId })).mealTimes?.breakfast, '08:00');
  assert.equal((await store.getDayActivity({ date, personId })).mealTimes?.lunch, '14:00');
});

test('schedules stay isolated by person/date and concurrent edits preserve other meals', async () => {
  const store = createLocalStore(new MemoryStorage());
  const other = await store.createPerson({ name: 'Test player', activityLevel: 'light', baselineCalories: 2000 });
  await Promise.all([
    store.saveMealTime({ date, personId, meal: 'breakfast', time: '09:00' }),
    store.saveMealTime({ date, personId, meal: 'dinner', time: '20:00' }),
  ]);
  assert.deepEqual((await store.getDayActivity({ date, personId })).mealTimes, { breakfast: '09:00', lunch: '13:00', dinner: '20:00', snack: '16:00' });
  assert.deepEqual(getMealTimes((await store.getDayActivity({ date: '2026-10-05', personId })).mealTimes), DEFAULT_MEAL_TIMES);
  assert.deepEqual(getMealTimes((await store.getDayActivity({ date, personId: other.id })).mealTimes), DEFAULT_MEAL_TIMES);
  await store.saveMealTime({ date, personId: other.id, meal: 'breakfast', time: '07:00' });
  await store.deletePerson(other.id);
  assert.equal((await store.getDayActivity({ date, personId })).mealTimes?.breakfast, '09:00');
});

test('tennis session/time/reference changes do not erase ordinary meal schedules and vice versa', async () => {
  const store = createLocalStore(new MemoryStorage());
  await store.saveMealTime({ date, personId, meal: 'breakfast', time: '09:00' });
  await store.saveDayActivity({ date, personId, activityType: 'training_120' });
  await store.saveTennisPlan({ date, personId, plan: {
    ...emptyTennisPlan(), sessions: [{ kind: 'practice', startTime: '10:00', durationMinutes: 90, intensity: 'moderate' }],
  } });
  const slot = await store.saveTennisDiet({ date, personId, phase: 'during', time: '10:30' });
  const food = (await store.listFoods())[0];
  const entry = await store.createMealEntry({ date, personId, meal: 'snack', grams: 100, foodId: food.id, tennisDietId: slot.id });
  await store.saveMealTime({ date, personId, meal: 'snack', time: '17:30' });
  await store.saveDayActivity({ date, personId, activityType: 'adolescent_athletes' });
  assert.deepEqual((await store.getDayActivity({ date, personId })).tennis?.diets, [slot]);
  assert.equal((await store.listMealEntries({ date, personId }))[0].tennisDietId, entry.tennisDietId);
  assert.equal((await store.getDayActivity({ date, personId })).mealTimes?.breakfast, '09:00');
  await store.saveTennisPlan({ date, personId, plan: null });
  assert.equal((await store.getDayActivity({ date, personId })).mealTimes?.snack, '17:30');
});

test('backups include meal times, old backups use defaults, malformed maps are rejected atomically', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await store.saveMealTime({ date, personId, meal: 'breakfast', time: '06:45' });
  const backup = await store.exportBackup(), restored = createLocalStore(new MemoryStorage());
  await restored.restoreBackup(backup);
  assert.deepEqual(await restored.getDayActivity({ date, personId }), await store.getDayActivity({ date, personId }));
  const legacy = JSON.parse(backup); delete legacy.data.activities[0].mealTimes;
  await restored.restoreBackup(JSON.stringify(legacy));
  assert.deepEqual(getMealTimes((await restored.getDayActivity({ date, personId })).mealTimes), DEFAULT_MEAL_TIMES);
  const bytes = storage.values.get(LOCAL_STORAGE_KEY);
  for (const bad of [null, [], {}, { ...DEFAULT_MEAL_TIMES, breakfast: '24:00' }, { ...DEFAULT_MEAL_TIMES, snack: 1700 }, { ...DEFAULT_MEAL_TIMES, extra: '12:00' }]) {
    const envelope = JSON.parse(backup); envelope.data.activities[0].mealTimes = bad;
    assert.throws(() => store.previewBackup(JSON.stringify(envelope)), /backup/i);
    await assert.rejects(store.restoreBackup(JSON.stringify(envelope)), /backup/i);
    assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  }
});

test('invalid meal/time/owner/date and failed writes never mutate saved foods or times', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await store.saveMealTime({ date, personId, meal: 'breakfast', time: '08:30' });
  const before = await store.exportForTests(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  for (const time of ['8:30', '24:00', '12:60', 'bad']) await assert.rejects(store.saveMealTime({ date, personId, meal: 'breakfast', time }), /HH:MM/);
  await assert.rejects(store.saveMealTime({ date, personId, meal: 'invalid' as Meal, time: '08:00' }), /valid meal/);
  await assert.rejects(store.saveMealTime({ date: '2026-02-30', personId, meal: 'breakfast', time: '08:00' }), /valid date/);
  await assert.rejects(store.saveMealTime({ date, personId: 999, meal: 'breakfast', time: '08:00' }), /Person/);
  storage.fail = true;
  await assert.rejects(store.saveMealTime({ date, personId, meal: 'breakfast', time: '09:00' }), /not applied/);
  assert.deepEqual(await store.exportForTests(), before);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
});
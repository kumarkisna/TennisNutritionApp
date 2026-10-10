// @ts-ignore Node modules are used by the standalone regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node modules are used by the standalone regression runner.
import test from 'node:test';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { emptyTennisPlan, tennisPlanProblem } from './tennis-planning';
import type { TennisPlan } from './local-models';

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
const plan = (): TennisPlan => ({
  ...emptyTennisPlan(), sessions: [{ kind: 'practice', startTime: '09:00', durationMinutes: 90, intensity: 'moderate' }],
});
async function prepareActiveDay(store: ReturnType<typeof createLocalStore>) {
  await store.saveDayActivity({ date, personId, activityType: 'training_120' });
}

test('scheduled diets attach actual portions and total them exactly once across phases', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const food = (await store.listFoods())[0];
  let calories = 0;
  for (const [phase, time] of [['before', '08:00'], ['during', '09:30'], ['after', '11:00']] as const) {
    const slot = await store.saveTennisDiet({ date, personId, phase, time });
    const entry = await store.createMealEntry({ date, personId, foodId: food.id, meal: 'snack', grams: 100, tennisDietId: slot.id });
    assert.equal(entry.tennisDietId, slot.id);
    calories += food.caloriesPer100g;
  }
  const summary = await store.getDailySummary({ date, personId });
  assert.equal(summary.entryCount, 3);
  assert.equal(summary.totals.calories, Math.round(calories * 10) / 10);
  const reloaded = createLocalStore(storage);
  assert.equal((await reloaded.getDayActivity({ date, personId })).tennis?.diets?.length, 3);
  assert.deepEqual(await reloaded.listMealEntries({ date, personId }), await store.listMealEntries({ date, personId }));
  const backup = await store.exportBackup(), restored = createLocalStore(new MemoryStorage());
  await restored.restoreBackup(backup);
  assert.deepEqual(await restored.getDailySummary({ date, personId }), summary);
  assert.deepEqual(await restored.getDayActivity({ date, personId }), await store.getDayActivity({ date, personId }));
  assert.deepEqual(await restored.listMealEntries({ date, personId }), await store.listMealEntries({ date, personId }));
});

test('time and stage edits preserve food links; stale session editor does not erase schedules', async () => {
  const store = createLocalStore(new MemoryStorage());
  const stalePlan = plan();
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: stalePlan });
  const slot = await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  const food = (await store.listFoods())[0];
  const entry = await store.createMealEntry({ date, personId, foodId: food.id, grams: 100, meal: 'breakfast', tennisDietId: slot.id });
  await store.saveTennisDiet({ date, personId, id: slot.id, phase: 'after', time: '11:30' });
  await store.saveTennisPlan({ date, personId, plan: stalePlan });
  assert.deepEqual((await store.getDayActivity({ date, personId })).tennis?.diets, [{ ...slot, phase: 'after', time: '11:30' }]);
  assert.equal((await store.listMealEntries({ date, personId }))[0].tennisDietId, slot.id);
  await store.updateMealEntry(entry.id, { grams: 75 });
  assert.equal((await store.listMealEntries({ date, personId }))[0].tennisDietId, slot.id);
  await store.updateMealEntry(entry.id, { tennisDietId: null });
  assert.equal((await store.listMealEntries({ date, personId }))[0].tennisDietId, undefined);
  assert.equal((await store.listMealEntries({ date, personId }))[0].grams, 75);
});

test('hydration can be linked to a tennis food slot and is preserved but unlinked when the slot is removed', async () => {
  const store = createLocalStore(new MemoryStorage());
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const slot = await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  await store.saveHydrationLog({ date, personId, hydration: {
    entries: [{ id: 'hydration-linked', time: '08:00', plannedMl: 250, actualMl: null, alertEnabled: false, tennisDietId: slot.id }],
    sessions: [],
  } });
  await store.saveTennisDiet({ date, personId, id: slot.id, phase: 'before', time: '08:30' });
  let log = (await store.getDayActivity({ date, personId })).hydration!;
  assert.equal(log.entries[0].time, '08:30');
  assert.equal(log.entries[0].tennisDietId, slot.id);
  await store.deleteTennisDiet({ date, personId, id: slot.id });
  log = (await store.getDayActivity({ date, personId })).hydration!;
  assert.equal(log.entries[0].tennisDietId, undefined);
  assert.equal(log.entries[0].plannedMl, 250);
  assert.equal(log.entries.length, 1);
});

test('removing a schedule or whole tennis plan unschedules but never removes food portions or changes totals', async () => {
  const store = createLocalStore(new MemoryStorage());
  await store.saveDayActivity({ date, personId, activityType: 'adolescent_athletes' });
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const first = await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  const second = await store.saveTennisDiet({ date, personId, phase: 'after', time: '11:00' });
  const food = (await store.listFoods())[0];
  for (const slot of [first, second]) await store.createMealEntry({ date, personId, foodId: food.id, grams: 100, meal: 'snack', tennisDietId: slot.id });
  const before = await store.getDailySummary({ date, personId });
  await store.deleteTennisDiet({ date, personId, id: first.id });
  assert.equal((await store.listMealEntries({ date, personId })).filter(entry => entry.tennisDietId).length, 1);
  assert.deepEqual(await store.getDailySummary({ date, personId }), before);
  await store.saveTennisPlan({ date, personId, plan: null });
  assert.equal((await store.listMealEntries({ date, personId })).filter(entry => entry.tennisDietId).length, 0);
  assert.deepEqual(await store.getDailySummary({ date, personId }), before);
  assert.equal((await store.getDayActivity({ date, personId })).activityType, 'adolescent_athletes');
});

test('assignment and reassignment reject stale slots, cross-person and cross-date links', async () => {
  const store = createLocalStore(new MemoryStorage());
  const other = await store.createPerson({ name: 'Test player', activityLevel: 'light', baselineCalories: 2000 });
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const first = await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  const second = await store.saveTennisDiet({ date, personId, phase: 'during', time: '09:45' });
  const food = (await store.listFoods())[0];
  const input = { date, personId, foodId: food.id, meal: 'snack' as const, grams: 100, tennisDietId: first.id };
  await assert.rejects(store.createMealEntry({ ...input, personId: other.id }), /unavailable/);
  await assert.rejects(store.createMealEntry({ ...input, date: '2026-10-05' }), /unavailable/);
  await assert.rejects(store.createMealEntry({ ...input, tennisDietId: 'diet-missing' }), /unavailable/);
  const entry = await store.createMealEntry(input);
  await store.updateMealEntry(entry.id, { tennisDietId: second.id });
  assert.equal((await store.listMealEntries({ date, personId }))[0].tennisDietId, second.id);
  await assert.rejects(store.updateMealEntry(entry.id, { tennisDietId: 'diet-missing', grams: 200 }), /unavailable/);
  assert.equal((await store.listMealEntries({ date, personId }))[0].grams, 100);
});

test('strict backup validation rejects malformed schedules and orphan links without modifying bytes', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const slot = await store.saveTennisDiet({ date, personId, phase: 'after', time: '11:30' });
  const food = (await store.listFoods())[0];
  await store.createMealEntry({ date, personId, foodId: food.id, grams: 100, meal: 'lunch', tennisDietId: slot.id });
  const backup = await store.exportBackup(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  for (const mutate of [
    (data: any) => { data.entries[0].tennisDietId = 'diet-missing'; },
    (data: any) => { data.activities[0].tennis.diets[0].time = '24:00'; },
    (data: any) => { data.activities[0].tennis.diets.push({ ...data.activities[0].tennis.diets[0] }); },
    (data: any) => { data.activities[0].tennis.diets[0].phase = 'invalid'; },
  ]) {
    const envelope = JSON.parse(backup); mutate(envelope.data);
    const malformed = JSON.stringify(envelope);
    assert.throws(() => store.previewBackup(malformed), /backup/i);
    await assert.rejects(store.restoreBackup(malformed), /backup/i);
    assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  }
});

test('failed schedule writes leave schedules, portions and committed state unchanged', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  const slot = await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  const food = (await store.listFoods())[0];
  await store.createMealEntry({ date, personId, foodId: food.id, grams: 100, meal: 'snack', tennisDietId: slot.id });
  const before = await store.exportForTests(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  storage.fail = true;
  await assert.rejects(store.saveTennisDiet({ date, personId, id: slot.id, phase: 'before', time: '08:30' }), /not applied/);
  await assert.rejects(store.deleteTennisDiet({ date, personId, id: slot.id }), /not applied/);
  await assert.rejects(store.saveTennisPlan({ date, personId, plan: null }), /not applied/);
  assert.deepEqual(await store.exportForTests(), before);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
});

test('invalid scheduled times, missing plans and schedule limits fail explicitly', async () => {
  const store = createLocalStore(new MemoryStorage());
  await assert.rejects(store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' }), /Save a tennis/);
  await prepareActiveDay(store);
  await store.saveTennisPlan({ date, personId, plan: plan() });
  for (const time of ['8:00', '24:00', '09:60', 'bad']) await assert.rejects(store.saveTennisDiet({ date, personId, phase: 'before', time }), /HH:MM/);
  for (let i = 0; i < 24; i++) await store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' });
  await assert.rejects(store.saveTennisDiet({ date, personId, phase: 'before', time: '08:00' }), /24/);
  const slots = (await store.getDayActivity({ date, personId })).tennis!.diets!;
  await store.saveTennisDiet({ date, personId, id: slots[0].id, phase: 'after', time: '11:00' });
  assert.equal(tennisPlanProblem((await store.getDayActivity({ date, personId })).tennis), null);
});
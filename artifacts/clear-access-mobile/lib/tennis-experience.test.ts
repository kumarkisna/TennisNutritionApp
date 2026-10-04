// @ts-ignore Node modules are used by the standalone regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node modules are used by the standalone regression runner.
import test from 'node:test';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { emptyTennisPlan } from './tennis-planning';
import { filterTennisPlanHistory, followingCalendarDate, getTennisFoodPlanFingerprint } from './tennis-copy';
import type { TennisPlanHistoryItem } from './local-models';

class MemoryStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
}

const personId = 1;
const dates = ['2026-10-01', '2026-10-02', '2026-10-03'];
function training() {
  return { ...emptyTennisPlan(), sessions: [{ kind: 'practice' as const, startTime: '09:00', durationMinutes: 60, intensity: 'moderate' as const }] };
}

test('whole-day ratings accept 0–10, can be cleared, survive plan edits, and restore from backup', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await store.saveDayActivity({ personId, date: dates[0], activityType: 'training_120' });
  await store.saveDayActivity({ personId, date: dates[1], activityType: 'training_120' });
  await store.saveTennisPlan({ personId, date: dates[0], plan: training() });
  await store.saveTennisPlan({ personId, date: dates[1], plan: training() });
  await store.saveTennisPlanRating({ personId, date: dates[0], rating: 0 });
  await store.saveTennisPlanRating({ personId, date: dates[1], rating: 10 });
  for (const rating of [-1, 11, 1.5, Number.NaN]) {
    const before = storage.values.get(LOCAL_STORAGE_KEY);
    await assert.rejects(store.saveTennisPlanRating({ personId, date: dates[0], rating }));
    assert.equal(storage.values.get(LOCAL_STORAGE_KEY), before);
  }
  await store.saveTennisPlan({ personId, date: dates[0], plan: training() });
  assert.equal((await store.getDayActivity({ personId, date: dates[0] })).tennis?.experienceRating, 0);
  await store.saveTennisPlanRating({ personId, date: dates[0], rating: null });
  const history = await store.listTennisPlanHistory(personId);
  assert.deepEqual(history.map(({ date, rating }) => [date, rating]), [[dates[1], 10], [dates[0], null]]);
  const restored = createLocalStore(new MemoryStorage());
  await restored.restoreBackup(await store.exportBackup());
  assert.deepEqual(await restored.listTennisPlanHistory(personId), history);
});

test('ratings require an existing plan and invalid scores are rejected in storage and backups', async () => {
  const storage = new MemoryStorage(), store = createLocalStore(storage);
  await assert.rejects(store.saveTennisPlanRating({ personId, date: dates[0], rating: 5 }), /Save a tennis plan/);
  await assert.rejects(store.saveTennisPlanRating({ personId: 99, date: dates[0], rating: 5 }), /not found/);
  await store.saveDayActivity({ personId, date: dates[0], activityType: 'training_120' });
  await store.saveTennisPlan({ personId, date: dates[0], plan: training() });
  await store.saveTennisPlanRating({ personId, date: dates[0], rating: 7 });
  const backup = JSON.parse(await store.exportBackup());
  backup.data.activities.find((day: { date: string }) => day.date === dates[0]).tennis.experienceRating = 11;
  assert.throws(() => store.previewBackup(JSON.stringify(backup)), /invalid day activity/i);
  await assert.rejects(store.restoreBackup(JSON.stringify(backup)), /invalid day activity/i);
  const stored = JSON.parse(storage.values.get(LOCAL_STORAGE_KEY)!);
  stored.activities.find((day: { date: string }) => day.date === dates[0]).tennis.experienceRating = -1;
  const corruptStorage = new MemoryStorage();
  corruptStorage.values.set(LOCAL_STORAGE_KEY, JSON.stringify(stored));
  await assert.rejects(createLocalStore(corruptStorage).listTennisPlanHistory(personId), /invalid day activity/i);
});

test('history is scoped to one person/date and counts only foods linked to timed slots', async () => {
  const store = createLocalStore(new MemoryStorage());
  const other = await store.createPerson({ name: 'Receiver', activityLevel: 'light', baselineCalories: 2000 });
  await store.saveDayActivity({ personId, date: dates[0], activityType: 'training_60' });
  await store.saveDayActivity({ personId, date: dates[1], activityType: 'endurance' });
  await store.saveTennisPlan({ personId, date: dates[0], plan: training() });
  await store.saveTennisPlan({ personId, date: dates[1], plan: emptyTennisPlan('rest') });
  const slot = await store.saveTennisDiet({ personId, date: dates[0], phase: 'before', time: '08:00' });
  const food = (await store.listFoods())[0];
  await store.createMealEntry({ personId, date: dates[0], meal: 'breakfast', foodId: food.id, grams: 75, tennisDietId: slot.id });
  await store.createMealEntry({ personId, date: dates[0], meal: 'dinner', foodId: food.id, grams: 50 });
  await store.saveDayActivity({ personId: other.id, date: dates[0], activityType: 'training_120' });
  await store.saveTennisPlan({ personId: other.id, date: dates[0], plan: training() });
  const rows = await store.listTennisPlanHistory(personId);
  assert.deepEqual(rows.map(row => [row.date, row.tennisDayType, row.activityType, row.sessions, row.slots, row.foods]), [
    [dates[1], 'rest', 'endurance', 0, 0, 0],
    [dates[0], 'training', 'training_60', 1, 1, 1],
  ]);
  assert.deepEqual((await store.listTennisPlanHistory(other.id)).map(row => row.date), [dates[0]]);
});

test('history filters combine rating, tennis day type, activity type, and the before-destination date', () => {
  const rows: TennisPlanHistoryItem[] = [
    { date: dates[0], rating: 0, tennisDayType: 'training', activityType: 'training_60', sessions: 1, slots: 1, foods: 1 },
    { date: dates[1], rating: null, tennisDayType: 'rest', activityType: 'rest', sessions: 0, slots: 0, foods: 0 },
    { date: dates[2], rating: 10, tennisDayType: 'tournament', activityType: 'endurance', sessions: 2, slots: 2, foods: 2 },
  ];
  assert.deepEqual(filterTennisPlanHistory(rows, { before: '2026-10-03', rating: 'any', tennisDayType: 'any', activityType: 'any' }), rows.slice(0, 2));
  assert.deepEqual(filterTennisPlanHistory(rows, { before: '2026-10-04', rating: 0, tennisDayType: 'training', activityType: 'training_60' }), [rows[0]]);
  assert.deepEqual(filterTennisPlanHistory(rows, { before: '2026-10-04', rating: 'unrated', tennisDayType: 'rest', activityType: 'rest' }), [rows[1]]);
  assert.deepEqual(filterTennisPlanHistory(rows, { before: '2026-10-04', rating: 9, tennisDayType: 'any', activityType: 'any' }), []);
  assert.deepEqual(filterTennisPlanHistory(rows, { before: '', rating: 'any', tennisDayType: 'any', activityType: 'any' }), []);
});

test('following dates advance across month ends, leap day, and year end', () => {
  assert.equal(followingCalendarDate('2026-01-31'), '2026-02-01');
  assert.equal(followingCalendarDate('2028-02-28'), '2028-02-29');
  assert.equal(followingCalendarDate('2028-02-29'), '2028-03-01');
  assert.equal(followingCalendarDate('2026-12-31'), '2027-01-01');
});

test('copying never transfers the source score and preserves a destination score', async () => {
  const store = createLocalStore(new MemoryStorage());
  const target = await store.createPerson({ name: 'Receiver', activityLevel: 'light', baselineCalories: 2000 });
  await store.saveDayActivity({ personId, date: dates[0], activityType: 'training_120' });
  await store.saveTennisPlan({ personId, date: dates[0], plan: training() });
  const slot = await store.saveTennisDiet({ personId, date: dates[0], phase: 'before', time: '08:00' });
  const food = (await store.listFoods())[0];
  await store.createMealEntry({ personId, date: dates[0], meal: 'breakfast', foodId: food.id, grams: 100, tennisDietId: slot.id });
  await store.saveTennisPlanRating({ personId, date: dates[0], rating: 9 });
  const source = (await store.getDayActivity({ personId, date: dates[0] })).tennis!;
  const entries = await store.listMealEntries({ personId, date: dates[0] });
  const input = {
    sourcePersonId: personId, sourceDate: dates[0], targetPersonId: target.id, targetDate: dates[1],
    expectedTargetName: target.name,
    expectedSource: getTennisFoodPlanFingerprint(source, entries, 'Me'),
  };
  await store.saveDayActivity({ personId: target.id, date: dates[1], activityType: 'training_120' });
  await store.copyTennisFoodPlan(input);
  assert.equal((await store.getDayActivity({ personId: target.id, date: dates[1] })).tennis?.experienceRating, undefined);
  assert.equal((await store.getDayActivity({ personId, date: dates[0] })).tennis?.experienceRating, 9);

  await store.saveTennisPlan({ personId: target.id, date: dates[2], plan: { ...emptyTennisPlan('rest'), experienceRating: 4 } });
  await store.copyTennisFoodPlan({ ...input, targetDate: dates[2] });
  assert.equal((await store.getDayActivity({ personId: target.id, date: dates[2] })).tennis?.experienceRating, 4);
});
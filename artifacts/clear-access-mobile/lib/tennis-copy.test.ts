// @ts-ignore Standalone Node runner.
import assert from 'node:assert/strict';
// @ts-ignore Standalone Node runner.
import test from 'node:test';
import { createLocalStore, LOCAL_STORAGE_KEY } from './local-store';
import { emptyTennisPlan } from './tennis-planning';
import { getTennisFoodDestinationFingerprint, getTennisFoodImportKey, getTennisFoodPlanFingerprint } from './tennis-copy';
import type { CopyTennisFoodPlanInput } from './local-models';

class Storage {
  values = new Map<string, string>(); fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { if (this.fail) throw new Error('injected failure'); this.values.set(key, value); }
}
const sourceDate = '2026-10-04', targetDate = '2026-10-06', sourcePersonId = 1;
async function setup() {
  const storage = new Storage(), store = createLocalStore(storage);
  const target = await store.createPerson({ name: 'Receiver', activityLevel: 'light', baselineCalories: 2000, ironGoalMg: 18, ironGoalSource: 'Test reference' });
  await store.saveDayActivity({ personId: sourcePersonId, date: sourceDate, activityType: 'training_120' });
  await store.saveDayActivity({ personId: target.id, date: targetDate, activityType: 'training_120' });
  await store.saveTennisPlan({ personId: sourcePersonId, date: sourceDate, plan: {
    ...emptyTennisPlan(), sessions: [{ kind: 'practice', startTime: '09:00', durationMinutes: 90, intensity: 'moderate' }],
  } });
  const food = (await store.listFoods())[0];
  for (const [phase, time, meal, grams] of [['before', '08:00', 'breakfast', 75], ['after', '11:00', 'lunch', 125]] as const) {
    const slot = await store.saveTennisDiet({ personId: sourcePersonId, date: sourceDate, phase, time });
    await store.createMealEntry({ personId: sourcePersonId, date: sourceDate, meal, foodId: food.id, grams, tennisDietId: slot.id });
  }
  await store.saveTennisDiet({ personId: sourcePersonId, date: sourceDate, phase: 'during', time: '09:45' });
  await store.createMealEntry({ personId: sourcePersonId, date: sourceDate, meal: 'dinner', foodId: food.id, grams: 200 });
  const input: CopyTennisFoodPlanInput = {
    sourcePersonId, sourceDate, targetPersonId: target.id, targetDate, expectedTargetName: target.name,
    expectedSource: getTennisFoodPlanFingerprint((await store.getDayActivity({ personId: sourcePersonId, date: sourceDate })).tennis!,
      await store.listMealEntries({ personId: sourcePersonId, date: sourceDate }), 'Me'),
    expectedTarget: getTennisFoodDestinationFingerprint(
      await store.getDayActivity({ personId: target.id, date: targetDate }),
      await store.listMealEntries({ personId: target.id, date: targetDate }), target.name,
    ),
  };
  return { store, storage, target, food, input };
}

async function refreshInput(
  store: ReturnType<typeof createLocalStore>, input: CopyTennisFoodPlanInput,
  changes: Partial<CopyTennisFoodPlanInput> = {},
): Promise<CopyTennisFoodPlanInput> {
  const next = { ...input, ...changes };
  const people = await store.listPeople();
  const sourcePerson = people.find(person => person.id === next.sourcePersonId)!;
  const targetPerson = people.find(person => person.id === next.targetPersonId)!;
  const source = (await store.getDayActivity({ personId: next.sourcePersonId, date: next.sourceDate })).tennis!;
  return {
    ...next, expectedTargetName: targetPerson.name,
    expectedSource: getTennisFoodPlanFingerprint(
      source, await store.listMealEntries({ personId: next.sourcePersonId, date: next.sourceDate }), sourcePerson.name,
    ),
    expectedTarget: getTennisFoodDestinationFingerprint(
      await store.getDayActivity({ personId: next.targetPersonId, date: next.targetDate }),
      await store.listMealEntries({ personId: next.targetPersonId, date: next.targetDate }), targetPerson.name,
    ),
  };
}

test('copies only linked foods and every timed slot, with new IDs, exact portions and once-only nutrition', async () => {
  const { store, target, input, food } = await setup();
  const sourceBefore = await store.getDayActivity({ personId: sourcePersonId, date: sourceDate });
  const entriesBefore = await store.listMealEntries({ personId: sourcePersonId, date: sourceDate });
  const peopleBefore = await store.listPeople();
  const result = await store.copyTennisFoodPlan(input);
  assert.deepEqual(result, { personId: target.id, date: targetDate, copiedSlots: 3, copiedFoods: 2, matchedSlots: 0, addedSlots: 3 });
  const day = await store.getDayActivity({ personId: target.id, date: targetDate });
  const entries = await store.listMealEntries({ personId: target.id, date: targetDate });
  assert.deepEqual(day.tennis?.sessions, []);
  assert.equal(day.tennis?.mode, 'rest');
  assert.deepEqual(day.tennis?.fuel, emptyTennisPlan().fuel);
  assert.deepEqual(day.tennis?.diets?.map(({ phase, time }) => ({ phase, time })), sourceBefore.tennis?.diets?.map(({ phase, time }) => ({ phase, time })));
  assert.equal(new Set(day.tennis?.diets?.map(slot => slot.id)).size, 3);
  assert.ok(day.tennis?.diets?.every(slot => !sourceBefore.tennis?.diets?.some(old => old.id === slot.id)));
  assert.deepEqual(entries.map(e => [e.meal, e.grams, e.food.id]), [['breakfast', 75, food.id], ['lunch', 125, food.id]]);
  assert.ok(entries.every(e => !entriesBefore.some(old => old.id === e.id) && day.tennis?.diets?.some(slot => slot.id === e.tennisDietId)));
  const summary = await store.getDailySummary({ personId: target.id, date: targetDate });
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.totals.calories, Math.round(entries.reduce((sum, entry) => sum + entry.nutrition.calories, 0) * 10) / 10);
  assert.deepEqual(await store.getDayActivity({ personId: sourcePersonId, date: sourceDate }), sourceBefore);
  assert.deepEqual(await store.listMealEntries({ personId: sourcePersonId, date: sourceDate }), entriesBefore);
  assert.deepEqual(await store.listPeople(), peopleBefore);
});
test('preserves destination ordinary portions, training sessions, activity, clocks, alerts and goals', async () => {
  const { store, target, input, food } = await setup();
  const params = { personId: target.id, date: targetDate };
  await store.saveDayActivity({ ...params, activityType: 'adolescent_athletes' });
  await store.saveMealTime({ ...params, meal: 'lunch', time: '14:00' });
  await store.saveMealAlerts({ ...params, meal: 'lunch', alerts: [{ id: 'alert-existing', minutesBefore: 15, enabled: true }] });
  const retained = await store.createMealEntry({ ...params, meal: 'dinner', foodId: food.id, grams: 50 });
  const ownPlan = { ...emptyTennisPlan('tournament'), sessions: [{ kind: 'match' as const, startTime: '15:00', durationMinutes: 60, intensity: 'hard' as const }] };
  await store.saveTennisPlan({ ...params, plan: ownPlan });
  const before = await store.getDayActivity(params), people = await store.listPeople();
  await store.copyTennisFoodPlan(await refreshInput(store, input));
  const after = await store.getDayActivity(params);
  assert.equal(after.activityType, before.activityType);
  assert.deepEqual(after.mealTimes, before.mealTimes); assert.deepEqual(after.mealAlerts, before.mealAlerts);
  assert.deepEqual(after.tennis?.sessions, ownPlan.sessions); assert.deepEqual(after.tennis?.fuel, ownPlan.fuel);
  assert.equal(after.tennis?.mode, 'tournament');
  assert.deepEqual((await store.listMealEntries(params)).find(e => e.id === retained.id), retained);
  assert.equal((await store.getDailySummary(params)).entryCount, 3);
  assert.deepEqual(await store.listPeople(), people);
});
test('source day selection is exact and another person may receive on the same date', async () => {
  const { store, input, target } = await setup();
  await store.saveDayActivity({ personId: target.id, date: sourceDate, activityType: 'training_120' });
  await store.copyTennisFoodPlan(await refreshInput(store, input, { targetDate: sourceDate }));
  assert.equal((await store.listMealEntries({ personId: target.id, date: sourceDate })).length, 2);
  assert.equal((await store.listMealEntries({ personId: target.id, date: targetDate })).length, 0);
  assert.deepEqual(await store.listTennisFoodPlanDates(sourcePersonId), [{ date: sourceDate, slots: 3, foods: 2 }]);
  assert.deepEqual(await store.listTennisFoodPlanDates(target.id), [{ date: sourceDate, slots: 3, foods: 2 }]);
});
test('existing destination timetables and repeated copies are rejected without replacing anything', async () => {
  const { store, input, storage } = await setup();
  await store.copyTennisFoodPlan(input);
  const before = storage.values.get(LOCAL_STORAGE_KEY), state = await store.exportForTests();
  await assert.rejects(store.copyTennisFoodPlan(await refreshInput(store, input)), /already has/);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), before);
  assert.deepEqual(await store.exportForTests(), state);
});

test('explicit cross-person merge maps exact stage/time matches, adds non-matching slots once, and preserves the destination', async () => {
  const { store, storage, input, target, food } = await setup();
  const params = { personId: target.id, date: sourceDate };
  await store.saveDayActivity({ ...params, activityType: 'adolescent_athletes' });
  const ownPlan = {
    ...emptyTennisPlan('tournament'),
    sessions: [{ kind: 'match' as const, startTime: '15:00', durationMinutes: 60, intensity: 'hard' as const }],
    experienceRating: 8,
  };
  await store.saveTennisPlan({ ...params, plan: ownPlan });
  const matchSlot = await store.saveTennisDiet({ ...params, phase: 'before', time: '08:00' });
  await store.saveTennisDiet({ ...params, phase: 'after', time: '12:00' });
  await store.saveMealTime({ ...params, meal: 'lunch', time: '14:15' });
  await store.saveMealAlerts({ ...params, meal: 'lunch', alerts: [{ id: 'alert-keep', minutesBefore: 15, enabled: true }] });
  const matchingFood = await store.createMealEntry({
    ...params, meal: 'breakfast', foodId: food.id, grams: 20, tennisDietId: matchSlot.id,
  });
  const ordinaryFood = await store.createMealEntry({ ...params, meal: 'dinner', foodId: food.id, grams: 40 });
  const beforeDay = await store.getDayActivity(params);
  const beforeEntries = await store.listMealEntries(params);
  const beforePeople = await store.listPeople();
  const linkedSource = (await store.listMealEntries({ personId: sourcePersonId, date: sourceDate }))
    .filter(entry => entry.tennisDietId);
  const importedCalories = linkedSource.reduce((sum, entry) => sum + entry.nutrition.calories, 0);

  const stalePreview = await refreshInput(store, input, { targetDate: sourceDate, mergeExisting: true });
  await store.updateMealEntry(matchingFood.id, { grams: 21 });
  const expectedMatchingFood = (await store.listMealEntries(params)).find(entry => entry.id === matchingFood.id)!;
  const baselineSummary = await store.getDailySummary(params);
  const afterEditBytes = storage.values.get(LOCAL_STORAGE_KEY);
  await assert.rejects(store.copyTennisFoodPlan(stalePreview), /destination changed since review/);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), afterEditBytes);

  const currentPreview = await refreshInput(store, input, { targetDate: sourceDate, mergeExisting: true });
  const beforeFailedWrite = await store.exportForTests();
  const beforeFailedBytes = storage.values.get(LOCAL_STORAGE_KEY);
  storage.fail = true;
  await assert.rejects(store.copyTennisFoodPlan(currentPreview), /not applied/);
  assert.deepEqual(await store.exportForTests(), beforeFailedWrite);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), beforeFailedBytes);
  storage.fail = false;

  const result = await store.copyTennisFoodPlan(currentPreview);
  assert.deepEqual(result, {
    personId: target.id, date: sourceDate, copiedSlots: 3, copiedFoods: 2, matchedSlots: 1, addedSlots: 2,
  });
  const afterDay = await store.getDayActivity(params);
  const afterEntries = await store.listMealEntries(params);
  assert.equal(afterDay.activityType, beforeDay.activityType);
  assert.deepEqual(afterDay.mealTimes, beforeDay.mealTimes);
  assert.deepEqual(afterDay.mealAlerts, beforeDay.mealAlerts);
  assert.deepEqual(afterDay.tennis?.sessions, ownPlan.sessions);
  assert.deepEqual(afterDay.tennis?.fuel, ownPlan.fuel);
  assert.equal(afterDay.tennis?.mode, ownPlan.mode);
  assert.equal(afterDay.tennis?.experienceRating, ownPlan.experienceRating);
  assert.deepEqual((await store.listPeople()).find(person => person.id === target.id), beforePeople.find(person => person.id === target.id));
  assert.equal(afterDay.tennis?.diets?.length, 4);
  const afterEleven = afterDay.tennis!.diets!.find(slot => slot.phase === 'after' && slot.time === '11:00')!;
  const duringSlot = afterDay.tennis!.diets!.find(slot => slot.phase === 'during' && slot.time === '09:45')!;
  const sourceBreakfast = afterEntries.find(entry => entry.meal === 'breakfast' && entry.grams === 75)!;
  const sourceLunch = afterEntries.find(entry => entry.meal === 'lunch' && entry.grams === 125)!;
  assert.equal(sourceBreakfast.tennisDietId, matchSlot.id);
  assert.equal(sourceLunch.tennisDietId, afterEleven.id);
  assert.notEqual(sourceLunch.tennisDietId, duringSlot.id);
  assert.deepEqual(afterEntries.find(entry => entry.id === matchingFood.id), expectedMatchingFood);
  assert.deepEqual(afterEntries.find(entry => entry.id === ordinaryFood.id), ordinaryFood);
  assert.equal(afterEntries.length, beforeEntries.length + linkedSource.length);
  assert.equal((await store.getDailySummary(params)).entryCount, baselineSummary.entryCount + linkedSource.length);
  assert.equal(
    (await store.getDailySummary(params)).totals.calories,
    Math.round((baselineSummary.totals.calories + importedCalories) * 10) / 10,
  );
  assert.equal(afterDay.tennisFoodImports?.length, 3);

  const repeatPreview = await refreshInput(store, currentPreview);
  const committed = await store.exportForTests();
  await assert.rejects(store.copyTennisFoodPlan(repeatPreview), /already been imported/);
  assert.deepEqual(await store.exportForTests(), committed);

  const backedUp = JSON.parse(await store.exportBackup());
  const restored = createLocalStore(new Storage());
  await restored.restoreBackup(JSON.stringify(backedUp));
  assert.deepEqual((await restored.getDayActivity(params)).tennisFoodImports, afterDay.tennisFoodImports);
  assert.deepEqual(await restored.listMealEntries(params), afterEntries);
  await assert.rejects(
    restored.copyTennisFoodPlan(await refreshInput(restored, repeatPreview)),
    /already been imported/,
  );

  const legacyBackup = JSON.parse(await store.exportBackup());
  for (const activity of legacyBackup.data.activities) delete activity.tennisFoodImports;
  const legacyRestored = createLocalStore(new Storage());
  await legacyRestored.restoreBackup(JSON.stringify(legacyBackup));
  assert.equal((await legacyRestored.getDayActivity(params)).tennisFoodImports, undefined);

  const malformedBackup = JSON.parse(await store.exportBackup());
  const mergedDay = malformedBackup.data.activities.find((day: { personId: number; date: string }) =>
    day.personId === target.id && day.date === sourceDate);
  mergedDay.tennisFoodImports = [{ sourcePersonBackupId: 'bad', sourceDate, sourceDietId: 'before-08' }];
  const rejectedStorage = new Storage();
  await assert.rejects(createLocalStore(rejectedStorage).restoreBackup(JSON.stringify(malformedBackup)), /backup/i);
  assert.equal(await rejectedStorage.getItem(LOCAL_STORAGE_KEY), null);

  const beforeUnlink = await store.getDailySummary(params);
  await store.deleteTennisDiet({ ...params, id: afterEleven.id });
  const afterUnlink = await store.getDailySummary(params);
  assert.equal(afterUnlink.entryCount, beforeUnlink.entryCount);
  assert.equal(afterUnlink.totals.calories, beforeUnlink.totals.calories);
  const retryAfterUnlink = await refreshInput(store, repeatPreview);
  const stateAfterUnlink = await store.exportForTests();
  await assert.rejects(store.copyTennisFoodPlan(retryAfterUnlink), /already been imported/);
  assert.deepEqual(await store.exportForTests(), stateAfterUnlink);
});

test('food-only copy works on a Rest destination without copying active sessions or changing activity', async () => {
  const { store, input, target } = await setup();
  await store.saveDayActivity({ personId: target.id, date: targetDate, activityType: 'rest' });
  await store.copyTennisFoodPlan(await refreshInput(store, input));
  const day = await store.getDayActivity({ personId: target.id, date: targetDate });
  assert.equal(day.activityType, 'rest');
  assert.equal(day.tennis?.mode, 'rest');
  assert.deepEqual(day.tennis?.sessions, []);
  assert.equal(day.tennis?.diets?.length, 3);
});
test('invalid dates, missing people, same-person same-date copy and absent source reject before writes', async () => {
  const { store, input, storage } = await setup();
  const before = storage.values.get(LOCAL_STORAGE_KEY);
  for (const change of [
    { sourceDate: '2026-02-30' }, { targetDate: 'not-a-date' }, { sourcePersonId: 999 }, { targetPersonId: 999 },
    { targetPersonId: sourcePersonId, targetDate: sourceDate, expectedTargetName: 'Me' }, { sourceDate: '2026-10-03' }, { expectedTargetName: 'Wrong person' },
  ]) {
    await assert.rejects(store.copyTennisFoodPlan({ ...input, ...change }));
    assert.equal(storage.values.get(LOCAL_STORAGE_KEY), before);
  }
});
test('same-person reuse copies to another date, preserves both days and creates independent portions', async () => {
  const { store, storage, input, food } = await setup();
  const sourceParams = { personId: sourcePersonId, date: sourceDate };
  const targetParams = { personId: sourcePersonId, date: targetDate };
  const sourceDay = await store.getDayActivity(sourceParams);
  const sourceEntries = await store.listMealEntries(sourceParams);
  const retained = await store.createMealEntry({ ...targetParams, meal: 'snack', foodId: food.id, grams: 50 });
  await store.saveMealTime({ ...targetParams, meal: 'lunch', time: '14:00' });
  await store.saveMealAlerts({ ...targetParams, meal: 'lunch', alerts: [{ id: 'alert-reuse', minutesBefore: 15, enabled: true }] });
  await store.saveDayActivity({ ...targetParams, activityType: 'training_120' });
  const ownPlan = { ...emptyTennisPlan(), sessions: [{ kind: 'practice' as const, startTime: '17:00', durationMinutes: 45, intensity: 'light' as const }] };
  await store.saveTennisPlan({ ...targetParams, plan: ownPlan });
  const targetBefore = await store.getDayActivity(targetParams), people = await store.listPeople();
  const selfInput = await refreshInput(store, input, { targetPersonId: sourcePersonId, expectedTargetName: 'Me' });
  assert.deepEqual(await store.copyTennisFoodPlan(selfInput), {
    ...targetParams, copiedSlots: 3, copiedFoods: 2, matchedSlots: 0, addedSlots: 3,
  });
  const copiedDay = await store.getDayActivity(targetParams), copiedEntries = await store.listMealEntries(targetParams);
  assert.deepEqual(copiedDay.tennis?.sessions, ownPlan.sessions);
  assert.deepEqual(copiedDay.mealTimes, targetBefore.mealTimes);
  assert.deepEqual(copiedDay.mealAlerts, targetBefore.mealAlerts);
  assert.deepEqual(copiedEntries.find(e => e.id === retained.id), retained);
  assert.equal(copiedEntries.length, 3);
  assert.ok(copiedDay.tennis?.diets?.every(slot => !sourceDay.tennis?.diets?.some(old => old.id === slot.id)));
  const copiedPortion = copiedEntries.find(e => e.tennisDietId)!;
  assert.ok(!sourceEntries.some(e => e.id === copiedPortion.id));
  await store.updateMealEntry(copiedPortion.id, { grams: 90 });
  assert.deepEqual(await store.listMealEntries(sourceParams), sourceEntries);
  assert.deepEqual(await store.getDayActivity(sourceParams), sourceDay);
  assert.deepEqual(await store.listPeople(), people);
  await assert.rejects(store.copyTennisFoodPlan(await refreshInput(store, selfInput)), /already has/);
  const reloaded = createLocalStore(storage);
  assert.deepEqual(await reloaded.getDayActivity(targetParams), copiedDay);
  assert.equal((await reloaded.listMealEntries(targetParams)).find(e => e.id === copiedPortion.id)?.grams, 90);
  const restored = createLocalStore(new Storage());
  await restored.restoreBackup(await store.exportBackup());
  assert.deepEqual(await restored.listMealEntries(targetParams), await store.listMealEntries(targetParams));
});
test('same-person reuse is available with only one saved person', async () => {
  const { store, input, target } = await setup();
  await store.deletePerson(target.id);
  assert.equal((await store.listPeople()).length, 1);
  await store.saveDayActivity({ personId: sourcePersonId, date: targetDate, activityType: 'training_120' });
  await store.copyTennisFoodPlan(await refreshInput(store, input, { targetPersonId: sourcePersonId, expectedTargetName: 'Me' }));
  assert.equal((await store.getDailySummary({ personId: sourcePersonId, date: targetDate })).entryCount, 2);
});
test('a changed source preview, including food metadata, never silently copies new contents', async () => {
  const { store, input, storage } = await setup();
  const entries = await store.listMealEntries({ personId: sourcePersonId, date: sourceDate });
  await store.updateMealEntry(entries[0].id, { grams: 99 });
  const before = storage.values.get(LOCAL_STORAGE_KEY);
  await assert.rejects(store.copyTennisFoodPlan(input), /source food plan changed/);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), before);
  const custom = await store.createFood({
    name: 'Custom test food', category: entries[0].food.category,
    caloriesPer100g: 120, proteinPer100g: 3, carbsPer100g: 20, fatPer100g: 2, fiberPer100g: 1,
  });
  await store.createMealEntry({ personId: sourcePersonId, date: sourceDate, foodId: custom.id, grams: 50, meal: 'snack', tennisDietId: entries[0].tennisDietId });
  const latest = await refreshInput(store, input);
  await store.updateFood(custom.id, { name: 'Changed test food', caloriesPer100g: 140 });
  const changedBytes = storage.values.get(LOCAL_STORAGE_KEY);
  await assert.rejects(store.copyTennisFoodPlan(latest), /changed/);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), changedBytes);
});
test('failed persistence is atomic, including entry IDs, and a retry survives reload and backup', async () => {
  const { store, storage, input } = await setup();
  const before = await store.exportForTests(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  storage.fail = true;
  await assert.rejects(store.copyTennisFoodPlan(input), /not applied/);
  assert.deepEqual(await store.exportForTests(), before); assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  storage.fail = false;
  await store.copyTennisFoodPlan(input);
  const reloaded = createLocalStore(storage);
  assert.deepEqual(await reloaded.exportForTests(), await store.exportForTests());
  const restored = createLocalStore(new Storage());
  await restored.restoreBackup(await store.exportBackup());
  assert.deepEqual(await restored.exportForTests(), await store.exportForTests());
});
test('overlapping copies to one destination commit only once', async () => {
  const { store, input, target } = await setup();
  const results = await Promise.allSettled([store.copyTennisFoodPlan(input), store.copyTennisFoodPlan(input)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await store.getDailySummary({ personId: target.id, date: targetDate })).entryCount, 2);
});

test('same-person reuse to a new day is atomic, isolated, editable, and survives reload and restore', async () => {
  const { store, storage, input, target } = await setup();
  const params = { personId: sourcePersonId, date: targetDate };
  const selfInput = await refreshInput(store, input, { targetPersonId: sourcePersonId, expectedTargetName: 'Me' });
  const before = await store.exportForTests(), bytes = storage.values.get(LOCAL_STORAGE_KEY);
  const sourceBefore = await store.getDayActivity({ personId: sourcePersonId, date: sourceDate });
  const sourceFoods = await store.listMealEntries({ personId: sourcePersonId, date: sourceDate });
  const otherBefore = await store.getDayActivity({ personId: target.id, date: targetDate });
  storage.fail = true;
  await assert.rejects(store.copyTennisFoodPlan(selfInput), /not applied/);
  assert.deepEqual(await store.exportForTests(), before);
  assert.equal(storage.values.get(LOCAL_STORAGE_KEY), bytes);
  storage.fail = false;
  await store.copyTennisFoodPlan(selfInput);
  const copied = await store.getDayActivity(params);
  assert.equal(copied.activityType, 'rest');
  assert.equal(copied.tennis?.mode, 'rest');
  assert.deepEqual(copied.tennis?.sessions, []);
  const slot = copied.tennis!.diets![0];
  await store.saveTennisDiet({ ...params, id: slot.id, phase: slot.phase, time: '07:15' });
  await store.saveDayActivity({ ...params, activityType: 'training_120' });
  await store.saveTennisPlan({ ...params, plan: {
    ...emptyTennisPlan(), sessions: [{ kind: 'practice', startTime: '18:00', durationMinutes: 60, intensity: 'moderate' }],
  } });
  assert.equal((await store.getDayActivity(params)).tennis?.diets?.find(d => d.id === slot.id)?.time, '07:15');
  assert.deepEqual(await store.getDayActivity({ personId: sourcePersonId, date: sourceDate }), sourceBefore);
  assert.deepEqual(await store.listMealEntries({ personId: sourcePersonId, date: sourceDate }), sourceFoods);
  assert.deepEqual(await store.getDayActivity({ personId: target.id, date: targetDate }), otherBefore);
  assert.equal((await store.listMealEntries({ personId: target.id, date: targetDate })).length, 0);
  const reloaded = createLocalStore(storage);
  assert.deepEqual(await reloaded.getDayActivity(params), await store.getDayActivity(params));
  assert.deepEqual(await reloaded.listMealEntries(params), await store.listMealEntries(params));
  const restored = createLocalStore(new Storage());
  await restored.restoreBackup(await store.exportBackup());
  assert.deepEqual(await restored.getDayActivity(params), await store.getDayActivity(params));
  assert.deepEqual(await restored.getDailySummary(params), await store.getDailySummary(params));
  const restoredBytes = await restored.exportForTests();
  await assert.rejects(restored.copyTennisFoodPlan(await refreshInput(restored, selfInput)), /already has/);
  assert.deepEqual(await restored.exportForTests(), restoredBytes);
});

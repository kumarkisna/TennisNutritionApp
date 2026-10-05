// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import test from 'node:test';
// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import { existsSync, readFileSync } from 'node:fs';
// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import { resolve } from 'node:path';
import { createLocalStore, type AsyncKeyValueStorage } from './local-store';
import type { PersonInput } from './local-models';
import { getAgeOnDate } from './planning-targets';
import { today } from './format';

class MemoryStorage implements AsyncKeyValueStorage {
  values = new Map<string, string>();
  failNextWrite = false;
  nextWriteGate: Promise<void> | null = null;
  activeWrites = 0;
  maxActiveWrites = 0;

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.activeWrites += 1;
    this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
    try {
      if (this.nextWriteGate) {
        const gate = this.nextWriteGate;
        this.nextWriteGate = null;
        await gate;
      }
      if (this.failNextWrite) {
        this.failNextWrite = false;
        throw new Error('injected write failure');
      }
      this.values.set(key, value);
    } finally {
      this.activeWrites -= 1;
    }
  }
}

const baselinePerson = (name: string): PersonInput => ({
  name,
  activityLevel: 'sedentary',
  baselineCalories: 2000,
});

test('adolescent athlete activity survives reload and local backup restore', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  const athlete = await store.createPerson({
    name: 'Adolescent athlete',
    weightKg: 50,
    dateOfBirth: '2004-03-04',
    activityLevel: 'moderate',
    baselineCalories: 2000,
  });
  const params = { personId: athlete.id, date: '2020-03-04' };
  await store.saveDayActivity({ ...params, activityType: 'adolescent_athletes' });
  const reloaded = createLocalStore(storage);
  assert.equal((await reloaded.getDayActivity(params)).activityType, 'adolescent_athletes');
  assert.equal((await reloaded.getDailySummary(params)).targetCalories, null);
  const backup = await reloaded.exportBackup();
  assert.equal(reloaded.previewBackup(backup).activities, 1);
  const restored = createLocalStore(new MemoryStorage());
  await restored.restoreBackup(backup);
  assert.equal((await restored.getDayActivity(params)).activityType, 'adolescent_athletes');
});

test('hydrates from the versioned seed and preserves changes across store restarts', async () => {
  const storage = new MemoryStorage();
  const firstStore = createLocalStore(storage);
  const people = await firstStore.listPeople();
  const foods = await firstStore.listFoods();
  assert.equal(people.length, 1);
  assert.equal(people[0].name, 'Me');
  assert.equal(people[0].targetCalories, 2000);
  assert.equal(foods.length, 23);
  assert.equal(foods[0].source, 'reference');
  assert.equal(foods[0].calciumMgPer100g, null);
  assert.equal(foods[0].ironMgPer100g, null);
  const created = await firstStore.createPerson(baselinePerson('Persisted'));

  const restartedStore = createLocalStore(storage);
  assert.equal((await restartedStore.listPeople()).find(person => person.id === created.id)?.name, 'Persisted');
});

test('migrates v1 data in-place without losing people, foods, entries, activities, or ID counters', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  const defaultPerson = (await store.listPeople())[0];
  const custom = await store.createPerson(baselinePerson('Legacy person'));
  const legacyFood = await store.createFood({
    name: 'Legacy custom food',
    category: 'other',
    caloriesPer100g: 120,
    proteinPer100g: 4,
    carbsPer100g: 20,
    fatPer100g: 3,
    fiberPer100g: 2,
  });
  await store.createMealEntry({
    date: '2020-03-04', personId: custom.id, meal: 'lunch', foodId: legacyFood.id, grams: 125,
  });
  await store.saveDayActivity({ date: '2020-03-04', personId: custom.id, activityType: 'strength' });
  const current = await store.exportForTests() as Record<string, unknown>;
  const legacyPeople = (current.people as Array<Record<string, unknown>>).map(person => {
    const { dateOfBirth: _dob, growthReferenceSex: _sex, nutritionGoal: _goal, ...legacyPerson } = person;
    return legacyPerson;
  });
  const { heightRecords: _records, nextHeightRecordId: _heightId, ...legacy } = current;
  const versionOne = { ...legacy, version: 1, people: legacyPeople };
  storage.values.set('clear-access-mobile:planner:v1', JSON.stringify(versionOne));

  const migratedStore = createLocalStore(storage);
  const people = await migratedStore.listPeople();
  assert.equal(people.length, 2);
  assert.equal(people.find(person => person.id === custom.id)?.dateOfBirth, null);
  assert.equal(people.find(person => person.id === custom.id)?.growthReferenceSex, null);
  const migratedData = await migratedStore.exportForTests() as Record<string, unknown>;
  assert.deepEqual(migratedData.foods, current.foods);
  assert.deepEqual(migratedData.entries, current.entries);
  assert.deepEqual(migratedData.activities, current.activities);
  assert.equal((await migratedStore.listFoods()).length, (current.foods as unknown[]).length);
  assert.equal((await migratedStore.listMealEntries({ date: '2020-03-04', personId: custom.id })).length, 1);
  assert.equal((await migratedStore.getDayActivity({ date: '2020-03-04', personId: custom.id })).activityType, 'strength');
  assert.equal((await migratedStore.listHeightRecords()).length, 0);
  const migrated = JSON.parse(storage.values.get('clear-access-mobile:planner:v1')!);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.nextPersonId, current.nextPersonId);
  assert.equal(migrated.nextFoodId, current.nextFoodId);
  assert.equal(migrated.nextEntryId, current.nextEntryId);
  assert.equal((await createLocalStore(storage).createPerson(baselinePerson('After migration'))).id, current.nextPersonId);
  assert.equal(people.find(person => person.id === defaultPerson.id)?.isDefault, true);
});

test('migrates v2 local data and old backups with no nutrition goal while preserving planner data', async () => {
  const storage = new MemoryStorage();
  const source = createLocalStore(storage);
  const person = await source.createPerson({
    ...baselinePerson('Weight goal legacy person'),
    nutritionGoal: 'weight_loss',
  });
  const food = await source.createFood({
    name: 'Legacy migration food',
    category: 'other',
    caloriesPer100g: 100,
    proteinPer100g: 4,
    carbsPer100g: 15,
    fatPer100g: 2,
    fiberPer100g: 3,
  });
  await source.createMealEntry({ date: '2020-03-04', personId: person.id, meal: 'lunch', foodId: food.id, grams: 125 });
  const current = await source.exportForTests() as Record<string, unknown>;
  const legacyPeople = (current.people as Array<Record<string, unknown>>).map(candidate => {
    const { nutritionGoal: _goal, ...legacyPerson } = candidate;
    return legacyPerson;
  });
  const legacyData = { ...current, version: 2, people: legacyPeople };

  storage.values.set('clear-access-mobile:planner:v1', JSON.stringify(legacyData));
  const migratedStore = createLocalStore(storage);
  const migratedPeople = await migratedStore.listPeople();
  assert.equal(migratedPeople.find(candidate => candidate.id === person.id)?.nutritionGoal, null);
  const migrated = JSON.parse(storage.values.get('clear-access-mobile:planner:v1')!);
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.foods, current.foods);
  assert.deepEqual(migrated.entries, current.entries);
  assert.deepEqual(migrated.activities, current.activities);

  const oldBackup = JSON.parse(await source.exportBackup());
  oldBackup.data = legacyData;
  const restoredStore = createLocalStore(new MemoryStorage());
  await restoredStore.restoreBackup(JSON.stringify(oldBackup));
  assert.equal((await restoredStore.listPeople()).find(candidate => candidate.id === person.id)?.nutritionGoal, null);
  assert.equal((await restoredStore.listMealEntries({ date: '2020-03-04', personId: person.id })).length, 1);
});

test('migrates v3 local data and backups by clearing ages without DOB and recalculating DOB ages', async () => {
  const storage = new MemoryStorage();
  const source = createLocalStore(storage);
  const noDob = await source.createPerson(baselinePerson('Legacy age without DOB'));
  const withDob = await source.createPerson({
    ...baselinePerson('Legacy age with DOB'),
    dateOfBirth: '2000-01-01',
  });
  const current = await source.exportForTests() as Record<string, unknown>;
  const legacyPeople = (current.people as Array<Record<string, unknown>>).map(person => ({
    ...person,
    ageYears: person.dateOfBirth === null ? 16 : 99,
  }));
  const versionThree = { ...current, version: 3, people: legacyPeople };

  storage.values.set('clear-access-mobile:planner:v1', JSON.stringify(versionThree));
  const migratedStore = createLocalStore(storage);
  const migratedPeople = await migratedStore.listPeople();
  assert.equal(migratedPeople.find(person => person.id === noDob.id)?.ageYears, null);
  assert.equal(migratedPeople.find(person => person.id === withDob.id)?.ageYears, getAgeOnDate('2000-01-01', today()));
  assert.equal(JSON.parse(storage.values.get('clear-access-mobile:planner:v1')!).version, 4);

  const oldBackup = JSON.parse(await source.exportBackup());
  oldBackup.data = versionThree;
  const restoredStore = createLocalStore(new MemoryStorage());
  await restoredStore.restoreBackup(JSON.stringify(oldBackup));
  const restoredPeople = await restoredStore.listPeople();
  assert.equal(restoredPeople.find(person => person.id === noDob.id)?.ageYears, null);
  assert.equal(restoredPeople.find(person => person.id === withDob.id)?.ageYears, getAgeOnDate('2000-01-01', today()));
});

test('calculates age from DOB on person creation and clears it when DOB is removed', async () => {
  const store = createLocalStore(new MemoryStorage());
  const dateOfBirth = '2000-01-01';
  const person = await store.createPerson({
    ...baselinePerson('Automatic age'),
    dateOfBirth,
  });
  assert.equal(person.ageYears, getAgeOnDate(dateOfBirth, today()));
  const updated = await store.updatePerson(person.id, { dateOfBirth: null });
  assert.equal(updated.ageYears, null);
});

test('tracks a weight-loss goal without changing daily activity-based calorie references', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  const person = await store.createPerson({
    ...baselinePerson('Weight goal owner'),
    weightKg: 68,
    dateOfBirth: '1988-03-04',
  });
  const params = { personId: person.id, date: '2020-03-04' };
  await store.saveDayActivity({ ...params, activityType: 'training_60' });
  const before = await store.getDailySummary(params);
  const updated = await store.updatePerson(person.id, { nutritionGoal: 'weight_loss' });
  assert.equal(updated.nutritionGoal, 'weight_loss');
  assert.deepEqual(await store.getDailySummary(params), before);
  assert.equal((await createLocalStore(storage).listPeople()).find(candidate => candidate.id === person.id)?.nutritionGoal, 'weight_loss');
  const cleared = await store.updatePerson(person.id, { nutritionGoal: null });
  assert.equal(cleared.nutritionGoal, null);
});

test('persists, date-sorts, updates, and deletes isolated height records', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  const alice = await store.createPerson(baselinePerson('Height Alice'));
  const bob = await store.createPerson(baselinePerson('Height Bob'));
  const older = await store.createHeightRecord({ personId: alice.id, date: '2020-01-10', heightCm: 100 });
  const newer = await store.createHeightRecord({ personId: alice.id, date: '2020-02-10', heightCm: 101 });
  const bobRecord = await store.createHeightRecord({ personId: bob.id, date: '2020-02-10', heightCm: 90 });
  assert.deepEqual((await store.listHeightRecords({ personId: alice.id })).map(record => record.id), [newer.id, older.id]);
  assert.deepEqual((await store.listHeightRecords({ personId: bob.id })).map(record => record.id), [bobRecord.id]);

  const updated = await store.updateHeightRecord(older.id, { date: '2020-03-10', heightCm: 102 });
  assert.equal(updated.heightCm, 102);
  assert.equal((await store.listHeightRecords({ personId: alice.id }))[0].id, older.id);
  const restarted = createLocalStore(storage);
  assert.equal((await restarted.listHeightRecords({ personId: alice.id })).length, 2);
  await restarted.deleteHeightRecord(newer.id);
  assert.deepEqual((await restarted.listHeightRecords({ personId: alice.id })).map(record => record.id), [older.id]);
});

test('rejects duplicate same-person measurement dates, but allows another person on that date', async () => {
  const store = createLocalStore(new MemoryStorage());
  const alice = await store.createPerson(baselinePerson('Duplicate Alice'));
  const bob = await store.createPerson(baselinePerson('Duplicate Bob'));
  await store.createHeightRecord({ personId: alice.id, date: '2020-01-01', heightCm: 120 });
  await assert.rejects(
    store.createHeightRecord({ personId: alice.id, date: '2020-01-01', heightCm: 121 }),
    /edit the existing record instead/i,
  );
  await store.createHeightRecord({ personId: bob.id, date: '2020-01-01', heightCm: 121 });
});

test('validates height and date-of-birth inputs against dates, future values, and existing measurements', async () => {
  const store = createLocalStore(new MemoryStorage());
  const person = await store.createPerson(baselinePerson('Validated height'));
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  await assert.rejects(store.createHeightRecord({ personId: person.id, date: '2021-02-29', heightCm: 100 }), /valid.*date/i);
  await assert.rejects(store.createHeightRecord({ personId: person.id, date: tomorrow, heightCm: 100 }), /future/i);
  await assert.rejects(store.createHeightRecord({ personId: person.id, date: '2020-01-01', heightCm: 19.9 }), /20 and 300/i);
  await assert.rejects(store.createHeightRecord({ personId: person.id, date: '2020-01-01', heightCm: 300.1 }), /20 and 300/i);
  await assert.rejects(store.createHeightRecord({ personId: 9999, date: '2020-01-01', heightCm: 100 }), /person not found/i);
  await assert.rejects(store.createPerson({ ...baselinePerson('Future DOB'), dateOfBirth: tomorrow }), /date of birth.*future/i);
  await assert.rejects(store.createPerson({ ...baselinePerson('Invalid DOB'), dateOfBirth: '2020-02-30' }), /valid date of birth/i);

  await store.createHeightRecord({ personId: person.id, date: '2020-01-01', heightCm: 100 });
  await assert.rejects(store.updatePerson(person.id, { dateOfBirth: '2020-01-02' }), /after an existing height/i);
  await store.updatePerson(person.id, { dateOfBirth: '2019-12-31', growthReferenceSex: 'female' });
  await assert.rejects(store.updateHeightRecord(1, { date: '2019-12-30' }), /before.*date of birth/i);
  await assert.rejects(store.updateHeightRecord(1, { heightCm: Number.NaN }), /20 and 300/i);
});

test('daily summary derives weight-and-activity calories and responds to person or activity edits', async () => {
  const store = createLocalStore(new MemoryStorage());
  const date = '2020-01-01';
  const adult = await store.createPerson({
    ...baselinePerson('Summary adult'),
    weightKg: 70,
    dateOfBirth: '1990-01-01',
  });
  assert.equal((await store.getDailySummary({ date, personId: adult.id })).targetCalories, 2100);
  await store.saveDayActivity({ date, personId: adult.id, activityType: 'strength' });
  assert.equal((await store.getDailySummary({ date, personId: adult.id })).targetCalories, 3150);
  await store.updatePerson(adult.id, { weightKg: 80 });
  assert.equal((await store.getDailySummary({ date, personId: adult.id })).targetCalories, 3600);

  const noAge = await store.createPerson({ ...baselinePerson('Summary no age'), weightKg: 70 });
  const noWeight = await store.createPerson({ ...baselinePerson('Summary no weight'), dateOfBirth: '1995-01-01' });
  const under18 = await store.createPerson({ ...baselinePerson('Summary under eighteen'), weightKg: 70, dateOfBirth: '2005-01-02' });
  assert.equal((await store.getDailySummary({ date, personId: noAge.id })).targetCalories, null);
  assert.equal((await store.getDailySummary({ date, personId: noWeight.id })).targetCalories, null);
  assert.equal((await store.getDailySummary({ date, personId: under18.id })).targetCalories, null);
});

test('deleting a person cascades only that person’s height records and protects the default', async () => {
  const store = createLocalStore(new MemoryStorage());
  const defaultPerson = (await store.listPeople())[0];
  const deleted = await store.createPerson(baselinePerson('Height cascade'));
  const retained = await store.createPerson(baselinePerson('Height retained'));
  await store.createHeightRecord({ personId: deleted.id, date: '2020-01-01', heightCm: 100 });
  await store.createHeightRecord({ personId: retained.id, date: '2020-01-01', heightCm: 110 });
  await assert.rejects(store.deletePerson(defaultPerson.id), /default person cannot be deleted/i);
  await store.deletePerson(deleted.id);
  assert.equal((await store.listHeightRecords({ personId: retained.id })).length, 1);
  assert.equal((await store.listHeightRecords()).length, 1);
});

test('a failed height-record persistence leaves committed and durable records unchanged', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  const person = await store.createPerson(baselinePerson('Durable height'));
  const saved = await store.createHeightRecord({ personId: person.id, date: '2020-01-01', heightCm: 100 });
  const committedBytes = storage.values.get('clear-access-mobile:planner:v1');
  storage.failNextWrite = true;
  await assert.rejects(store.createHeightRecord({ personId: person.id, date: '2020-01-02', heightCm: 101 }), /change was not applied/i);
  assert.deepEqual(await store.listHeightRecords(), [saved]);
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), committedBytes);
  assert.deepEqual(await createLocalStore(storage).listHeightRecords(), [saved]);
});

test('device-local height query and mutation hooks are configured to run while offline', () => {
  const apiPath = [
    resolve(process.cwd(), 'lib/local-api.ts'),
    resolve(process.cwd(), 'artifacts/clear-access-mobile/lib/local-api.ts'),
  ].find(existsSync);
  assert.ok(apiPath, 'local API source should be available to the regression test');
  const apiSource = readFileSync(apiPath, 'utf8');
  assert.match(apiSource, /networkMode:\s*'always'/);
  assert.equal((apiSource.match(/networkMode:\s*'always'/g) ?? []).length, 2);
  assert.match(apiSource, /useListHeightRecords[\s\S]*?useLocalQuery/);
  assert.match(apiSource, /useCreateHeightRecord[\s\S]*?useLocalMutation/);
});

test('keeps entries and activity isolated by person and date, and cascades only a deleted person', async () => {
  const store = createLocalStore(new MemoryStorage());
  const defaultPerson = (await store.listPeople())[0];
  const alice = await store.createPerson(baselinePerson('Alice'));
  const bob = await store.createPerson(baselinePerson('Bob'));
  const oats = (await store.listFoods({ search: 'oats' }))[0];
  const date = '2026-09-29';
  await store.createMealEntry({ date, personId: alice.id, meal: 'breakfast', foodId: oats.id, grams: 50 });
  await store.createMealEntry({ date, personId: bob.id, meal: 'breakfast', foodId: oats.id, grams: 100 });
  await store.createMealEntry({ date: '2026-09-30', personId: alice.id, meal: 'lunch', foodId: oats.id, grams: 100 });
  await store.saveDayActivity({ date, personId: alice.id, activityType: 'training_60' });
  await store.saveDayActivity({ date, personId: bob.id, activityType: 'strength' });

  assert.equal((await store.listMealEntries({ date, personId: alice.id })).length, 1);
  assert.equal((await store.listMealEntries({ date: '2026-09-30', personId: alice.id })).length, 1);
  assert.equal((await store.getDayActivity({ date, personId: bob.id })).activityType, 'strength');
  await assert.rejects(store.deletePerson(defaultPerson.id), /default person cannot be deleted/i);
  await store.deletePerson(alice.id);
  assert.equal((await store.listMealEntries({ date, personId: bob.id })).length, 1);
  assert.equal((await store.getDayActivity({ date, personId: bob.id })).activityType, 'strength');
  await assert.rejects(store.listMealEntries({ date, personId: alice.id }), /person not found/i);
});

test('enforces custom-food protections, clears nullable goal metadata, and reports incomplete minerals as null', async () => {
  const store = createLocalStore(new MemoryStorage());
  const person = await store.createPerson({
    ...baselinePerson('Goal user'),
    ironGoalMg: 18,
    ironGoalSource: 'Dietitian',
    ironGoalReviewedOn: '2026-01-02',
    fatGoalG: 65,
    fatGoalSource: 'Personal plan',
  });
  const cleared = await store.updatePerson(person.id, { ironGoalMg: null, fatGoalG: null });
  assert.equal(cleared.ironGoalMg, null);
  assert.equal(cleared.ironGoalSource, null);
  assert.equal(cleared.ironGoalReviewedOn, null);
  assert.equal(cleared.fatGoalG, null);
  assert.equal(cleared.fatGoalSource, null);

  const custom = await store.createFood({
    name: 'Test food',
    category: 'other',
    caloriesPer100g: 100,
    proteinPer100g: 3,
    carbsPer100g: 10,
    fatPer100g: 2,
    fiberPer100g: 1,
    calciumMgPer100g: 12,
    ironMgPer100g: 1,
  });
  const reference = (await store.listFoods())[0];
  await assert.rejects(store.updateFood(reference.id, { name: 'Changed reference' }), /only custom foods/i);
  await assert.rejects(store.deleteFood(reference.id), /only custom or saved foods/i);
  const date = '2026-09-29';
  await store.createMealEntry({ date, personId: person.id, meal: 'breakfast', foodId: custom.id, grams: 100 });
  await store.createMealEntry({ date, personId: person.id, meal: 'lunch', foodId: reference.id, grams: 100 });
  await assert.rejects(store.deleteFood(custom.id), /planned meals/i);
  const summary = await store.getDailySummary({ date, personId: person.id });
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.totals.calciumMg, null);
  assert.equal(summary.totals.ironMg, null);
  assert.equal(summary.totals.fiber, 13.5);
  await store.deleteMealEntry(1);
  await store.deleteMealEntry(2);
  await store.deleteFood(custom.id);
  await assert.rejects(store.deleteFood(reference.id), /only custom or saved foods/i);
});

test('saved food entries can be deleted from the library, but references and meal-linked foods are protected', async () => {
  const store = createLocalStore(new MemoryStorage());
  const [person] = await store.listPeople();
  const library = JSON.parse(await store.exportFoodLibrary());
  library.foods = [{
    ...library.foods[0],
    id: 9999,
    name: 'Saved food deletion test',
    brand: 'Test brand',
    source: 'open_food_facts',
    sourceUrl: 'https://world.openfoodfacts.org/product/123',
  }];
  await store.importFoodLibrary(JSON.stringify(library));

  const saved = (await store.listFoods()).find(food => food.name === 'Saved food deletion test');
  if (!saved) throw new Error('Imported saved food was not found.');
  const entry = await store.createMealEntry({
    date: '2026-10-05',
    personId: person.id,
    meal: 'breakfast',
    foodId: saved.id,
    grams: 100,
  });
  await assert.rejects(store.deleteFood(saved.id), /planned meals/i);
  await store.deleteMealEntry(entry.id);
  await store.deleteFood(saved.id);
  assert.equal((await store.listFoods()).some(food => food.id === saved.id), false);

  const reference = (await store.listFoods()).find(food => food.source === 'reference');
  if (!reference) throw new Error('The reference foods were not loaded.');
  await assert.rejects(store.deleteFood(reference.id), /only custom or saved foods/i);
});

test('a rejected storage write leaves the committed in-memory state untouched', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  await store.listPeople();
  const existing = await store.createPerson(baselinePerson('Saved'));
  storage.failNextWrite = true;
  await assert.rejects(store.createPerson(baselinePerson('Not saved')), /change was not applied/);
  assert.equal((await store.listPeople()).length, 2);
  assert.equal((await store.listPeople()).some(person => person.name === 'Not saved'), false);
  const restarted = createLocalStore(storage);
  assert.equal((await restarted.listPeople()).some(person => person.id === existing.id), true);
  assert.equal((await restarted.listPeople()).some(person => person.name === 'Not saved'), false);
});

test('refuses corrupt or unknown-version persistence without replacing stored bytes', async () => {
  const storage = new MemoryStorage();
  const corrupt = '{not valid json';
  storage.values.set('clear-access-mobile:planner:v1', corrupt);
  const brokenStore = createLocalStore(storage);
  await assert.rejects(brokenStore.listPeople(), /storage is corrupted/i);
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), corrupt);

  storage.values.set('clear-access-mobile:planner:v1', JSON.stringify({ version: 999 }));
  const futureStore = createLocalStore(storage);
  await assert.rejects(futureStore.listPeople(), /unsupported local planner storage version/i);
  assert.deepEqual(JSON.parse(storage.values.get('clear-access-mobile:planner:v1')!), { version: 999 });
});

test('serializes overlapping writes and assigns unique incremental IDs', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  await store.listPeople();
  let releaseWrite!: () => void;
  storage.nextWriteGate = new Promise<void>(resolve => { releaseWrite = resolve; });
  const first = store.createPerson(baselinePerson('First queued'));
  const second = store.createPerson(baselinePerson('Second queued'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(storage.maxActiveWrites, 1);
  releaseWrite();
  const [one, two] = await Promise.all([first, second]);
  assert.notEqual(one.id, two.id);
  assert.equal((await store.listPeople()).length, 3);
  assert.equal(storage.maxActiveWrites, 1);
});

test('backup round-trips all people, preferences, goals, height records, foods, and summaries', async () => {
  const storage = new MemoryStorage();
  const source = createLocalStore(storage);
  const defaultPerson = (await source.listPeople())[0];
  await source.updatePerson(defaultPerson.id, {
    weightKg: 68,
    dateOfBirth: '1992-01-01',
    activityLevel: 'light',
    baselineCalories: 2150,
  });
  const alice = await source.createPerson({
    ...baselinePerson('Backup Alice'),
    weightKg: 62.5,
    dateOfBirth: '1994-04-12',
    growthReferenceSex: 'female',
    ironGoalMg: 18,
    ironGoalSource: 'Dietitian recommendation',
    ironGoalReviewedOn: '2024-05-06',
    fatGoalG: 70,
    fatGoalSource: 'Personal plan',
    fatGoalReviewedOn: '2024-03-02',
    nutritionGoal: 'weight_loss',
    activityLevel: 'moderate',
    baselineCalories: 2250,
  });
  const bob = await source.createPerson({
    ...baselinePerson('Backup Bob'),
    weightKg: 79,
    activityLevel: 'very_active',
    baselineCalories: 2400,
  });
  const unknownMinerals = await source.createFood({
    name: 'Backup food with unknown minerals',
    category: 'other',
    caloriesPer100g: 180,
    proteinPer100g: 7,
    carbsPer100g: 22,
    fatPer100g: 6,
    fiberPer100g: 4,
    calciumMgPer100g: null,
    ironMgPer100g: null,
  });
  const oats = (await source.listFoods({ search: 'oats' }))[0];
  const date = '2020-05-04';
  await source.createMealEntry({ date, personId: alice.id, meal: 'breakfast', foodId: oats.id, grams: 45 });
  await source.createMealEntry({ date, personId: alice.id, meal: 'lunch', foodId: unknownMinerals.id, grams: 120 });
  await source.createMealEntry({ date, personId: bob.id, meal: 'breakfast', foodId: oats.id, grams: 80 });
  await source.saveDayActivity({ date, personId: alice.id, activityType: 'strength' });
  await source.saveDayActivity({ date, personId: bob.id, activityType: 'endurance' });
  await source.createHeightRecord({ personId: alice.id, date: '2020-01-10', heightCm: 165.4 });
  await source.createHeightRecord({ personId: bob.id, date: '2020-02-11', heightCm: 181 });

  const expectedData = await source.exportForTests();
  const durableBytes = storage.values.get('clear-access-mobile:planner:v1');
  const serialized = await source.exportBackup();
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.format, 'clear-access-local-backup');
  assert.equal(envelope.version, 1);
  assert.equal(new Date(envelope.createdAt).toISOString(), envelope.createdAt);
  assert.deepEqual(envelope.data, expectedData);
  assert.match(serialized, /\n  "format"/, 'backup JSON should be pretty-printed');
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), durableBytes, 'export must not write storage');

  const beforePreview = await source.exportForTests();
  const preview = source.previewBackup(serialized);
  assert.deepEqual(preview.people, [
    { id: defaultPerson.id, name: 'Me', entries: 0, activities: 0, heightRecords: 0 },
    { id: alice.id, name: 'Backup Alice', entries: 2, activities: 1, heightRecords: 1 },
    { id: bob.id, name: 'Backup Bob', entries: 1, activities: 1, heightRecords: 1 },
  ]);
  assert.equal(preview.foods, (expectedData as { foods: unknown[] }).foods.length);
  assert.equal(preview.entries, 3);
  assert.equal(preview.activities, 2);
  assert.equal(preview.heightRecords, 2);
  assert.deepEqual(await source.exportForTests(), beforePreview, 'preview must not mutate in-memory state');
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), durableBytes, 'preview must not write storage');

  const destinationStorage = new MemoryStorage();
  const destination = createLocalStore(destinationStorage);
  await destination.createPerson(baselinePerson('Will be replaced'));
  await destination.restoreBackup(serialized);
  assert.deepEqual(await destination.exportForTests(), expectedData);
  assert.equal((await destination.listPeople()).some(person => person.name === 'Will be replaced'), false);
  assert.deepEqual(
    await destination.getDailySummary({ date, personId: alice.id }),
    await source.getDailySummary({ date, personId: alice.id }),
  );
  assert.deepEqual(await destination.listHeightRecords(), await source.listHeightRecords());
  const restoredAlice = (await destination.listPeople()).find(person => person.id === alice.id)!;
  assert.equal(restoredAlice.ironGoalSource, 'Dietitian recommendation');
  assert.equal(restoredAlice.ironGoalReviewedOn, '2024-05-06');
  assert.equal(restoredAlice.fatGoalG, 70);
  assert.equal(restoredAlice.nutritionGoal, 'weight_loss');
  assert.equal(restoredAlice.activityLevel, 'moderate');
  assert.equal(restoredAlice.activityMultiplier, 1.2);
  assert.equal(restoredAlice.targetCalories, 2700);
  const restoredUnknownMinerals = (await destination.listFoods({ search: 'unknown minerals' }))[0];
  assert.equal(restoredUnknownMinerals.calciumMgPer100g, null);
  assert.equal(restoredUnknownMinerals.ironMgPer100g, null);
  assert.deepEqual(
    await createLocalStore(destinationStorage).exportForTests(),
    expectedData,
    'the imported values must survive a fresh store instance unchanged',
  );
});

test('backup preview and restore reject malformed envelopes, model fields, dates, relationships, and counters', async () => {
  const source = createLocalStore(new MemoryStorage());
  const person = await source.createPerson({
    ...baselinePerson('Strict backup person'),
    ironGoalMg: 15,
    ironGoalSource: 'Plan',
    ironGoalReviewedOn: '2024-01-02',
  });
  const food = await source.createFood({
    name: 'Strict backup food',
    category: 'other',
    caloriesPer100g: 100,
    proteinPer100g: 2,
    carbsPer100g: 10,
    fatPer100g: 3,
    fiberPer100g: 2,
  });
  await source.createMealEntry({ date: '2020-01-01', personId: person.id, meal: 'lunch', foodId: food.id, grams: 100 });
  await source.saveDayActivity({ date: '2020-01-01', personId: person.id, activityType: 'rest' });
  await source.createHeightRecord({ personId: person.id, date: '2020-01-01', heightCm: 150 });
  const goodBackup = await source.exportBackup();
  const malformed = [
    '{not JSON',
    JSON.stringify({ ...JSON.parse(goodBackup), version: 99 }),
    JSON.stringify({ ...JSON.parse(goodBackup), createdAt: 'yesterday' }),
    JSON.stringify({ ...JSON.parse(goodBackup), data: { ...JSON.parse(goodBackup).data, entries: undefined } }),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people.find((candidate: { id: number }) => candidate.id === person.id).dateOfBirth = '2021-02-29';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people.find((candidate: { id: number }) => candidate.id === person.id).ironGoalReviewedOn = '2024-02-30';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people.find((candidate: { id: number }) => candidate.id === person.id).ironGoalSource = 42;
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people.find((candidate: { id: number }) => candidate.id === person.id).nutritionGoal = 'rapid_loss';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      const candidate = value.data.people.find((entry: { id: number }) => entry.id === person.id);
      candidate.activityMultiplier = 1.2;
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      const candidate = value.data.people.find((entry: { id: number }) => entry.id === person.id);
      candidate.targetCalories = 999999;
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.entries[0].personId = 99999;
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.heightRecords[0].date = 'not-a-date';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.heightRecords[0].personId = 99999;
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.activities.push({ ...value.data.activities[0] });
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.foods[0].caloriesPer100g = '100';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.foods[0].brand = { invalid: true };
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people[0].isDefault = 'true';
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.people.push({ ...value.data.people[0] });
      return JSON.stringify(value);
    })(),
    (() => {
      const value = JSON.parse(goodBackup);
      value.data.nextEntryId = value.data.entries[0].id;
      return JSON.stringify(value);
    })(),
  ];

  const storage = new MemoryStorage();
  const destination = createLocalStore(storage);
  await destination.listPeople();
  const originalBytes = storage.values.get('clear-access-mobile:planner:v1');
  const originalState = await destination.exportForTests();
  for (const serialized of malformed) {
    assert.throws(() => destination.previewBackup(serialized), /backup|unsupported/i);
    await assert.rejects(destination.restoreBackup(serialized), /backup|unsupported/i);
    assert.equal(storage.values.get('clear-access-mobile:planner:v1'), originalBytes);
    assert.deepEqual(await destination.exportForTests(), originalState);
  }
});

test('legacy migration exports, previews, restores, and preserves finite out-of-range nutrition facts', async () => {
  const storage = new MemoryStorage();
  const original = createLocalStore(storage);
  const person = (await original.listPeople())[0];
  const oats = (await original.listFoods({ search: 'oats' }))[0];
  await original.createMealEntry({
    date: '2020-03-04',
    personId: person.id,
    meal: 'breakfast',
    foodId: oats.id,
    grams: 100,
  });

  const current = await original.exportForTests() as Record<string, unknown>;
  const legacyFoods = current.foods as Array<Record<string, unknown>>;
  const legacyOats = legacyFoods.find(food => food.id === oats.id)!;
  Object.assign(legacyOats, {
    caloriesPer100g: 1500.5,
    proteinPer100g: 120.25,
    carbsPer100g: -8.5,
    fatPer100g: 145,
    fiberPer100g: 110,
    calciumMgPer100g: 25000,
    ironMgPer100g: 2500,
  });
  const legacyPeople = (current.people as Array<Record<string, unknown>>).map(candidate => {
    const { dateOfBirth: _dob, growthReferenceSex: _sex, ...legacyPerson } = candidate;
    return legacyPerson;
  });
  const { heightRecords: _records, nextHeightRecordId: _heightId, ...legacyData } = current;
  const versionOne = { ...legacyData, version: 1, people: legacyPeople };
  storage.values.set('clear-access-mobile:planner:v1', JSON.stringify(versionOne));

  const migrated = createLocalStore(storage);
  await migrated.listPeople();
  const migratedData = await migrated.exportForTests();
  const backup = await migrated.exportBackup();
  const preview = migrated.previewBackup(backup);
  assert.equal(preview.entries, 1);
  assert.equal(preview.foods, legacyFoods.length);
  assert.equal(preview.people[0].entries, 1);

  const destinationStorage = new MemoryStorage();
  await createLocalStore(destinationStorage).restoreBackup(backup);
  const reloaded = createLocalStore(destinationStorage);
  assert.deepEqual(await reloaded.exportForTests(), migratedData);
  const summary = await reloaded.getDailySummary({ date: '2020-03-04', personId: person.id });
  assert.deepEqual(summary.totals, {
    calories: 1500.5,
    protein: 120.3,
    carbs: -8.5,
    fat: 145,
    fiber: 110,
    calciumMg: 25000,
    ironMg: 2500,
  });
  assert.deepEqual(
    await createLocalStore(destinationStorage).exportForTests(),
    migratedData,
    'legacy food facts must remain exact in durable restored storage',
  );
});

test('backup summary works for trusted legacy state while unsupported exports fail before returning', async () => {
  const storage = new MemoryStorage();
  const initialized = createLocalStore(storage);
  await initialized.listPeople();
  const stored = JSON.parse(storage.values.get('clear-access-mobile:planner:v1')!);
  stored.people[0].legacyUnsupportedField = 'kept in existing storage';
  const originalBytes = JSON.stringify(stored);
  storage.values.set('clear-access-mobile:planner:v1', originalBytes);

  const legacyStore = createLocalStore(storage);
  const summary = await legacyStore.getBackupSummary();
  assert.equal(summary.people.length, 1);
  assert.equal(summary.people[0].name, 'Me');
  assert.equal(summary.entries, 0);
  assert.equal(summary.foods, stored.foods.length);
  await assert.rejects(legacyStore.exportBackup(), /backup contains an invalid person/i);
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), originalBytes);
  const summaryAfterRejectedExport = await legacyStore.getBackupSummary();
  assert.deepEqual(summaryAfterRejectedExport.people, summary.people);
  assert.equal(summaryAfterRejectedExport.foods, summary.foods);
  assert.equal(summaryAfterRejectedExport.entries, summary.entries);
});

test('failed atomic backup restore leaves durable and in-memory state unchanged', async () => {
  const destinationStorage = new MemoryStorage();
  const destination = createLocalStore(destinationStorage);
  await destination.createPerson(baselinePerson('Existing destination person'));
  const originalBytes = destinationStorage.values.get('clear-access-mobile:planner:v1');
  const originalState = await destination.exportForTests();

  const source = createLocalStore(new MemoryStorage());
  await source.createPerson(baselinePerson('Imported person'));
  const backup = await source.exportBackup();
  destinationStorage.failNextWrite = true;
  await assert.rejects(destination.restoreBackup(backup), /change was not applied/i);
  assert.equal(destinationStorage.values.get('clear-access-mobile:planner:v1'), originalBytes);
  assert.deepEqual(await destination.exportForTests(), originalState);
  assert.deepEqual(await createLocalStore(destinationStorage).exportForTests(), originalState);
});

test('export is ordered between queued writes and restore remains serialized with writes', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  await store.listPeople();
  let releaseWrite!: () => void;
  storage.nextWriteGate = new Promise<void>(resolve => { releaseWrite = resolve; });
  const beforeExport = store.createPerson(baselinePerson('Before export'));
  const backupPromise = store.exportBackup();
  const afterExport = store.createPerson(baselinePerson('After export'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(storage.maxActiveWrites, 1);
  releaseWrite();
  await beforeExport;
  const backup = JSON.parse(await backupPromise);
  await afterExport;
  assert.equal(backup.data.people.some((person: { name: string }) => person.name === 'Before export'), true);
  assert.equal(backup.data.people.some((person: { name: string }) => person.name === 'After export'), false);
  assert.equal(storage.maxActiveWrites, 1);

  const source = createLocalStore(new MemoryStorage());
  await source.createPerson(baselinePerson('Restored before later write'));
  const restoreBackup = await source.exportBackup();
  storage.nextWriteGate = new Promise<void>(resolve => { releaseWrite = resolve; });
  const beforeRestore = store.createPerson(baselinePerson('Queued before restore'));
  const restoring = store.restoreBackup(restoreBackup);
  const afterRestore = store.createPerson(baselinePerson('Queued after restore'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(storage.maxActiveWrites, 1);
  releaseWrite();
  await Promise.all([beforeRestore, restoring, afterRestore]);
  assert.equal(storage.maxActiveWrites, 1);
  const finalPeople = await store.listPeople();
  assert.deepEqual(finalPeople.map(person => person.name), ['Me', 'Restored before later write', 'Queued after restore']);
});

test('food-library files export every food and safely merge exact matches without overwriting ID collisions', async () => {
  const source = createLocalStore(new MemoryStorage());
  await source.listFoods();
  for (let index = 0; index < 101; index += 1) {
    await source.createFood({
      name: `Food export ${String(index).padStart(3, '0')}`,
      category: 'other',
      caloriesPer100g: 80 + index % 10,
      proteinPer100g: 5,
      carbsPer100g: 10,
      fatPer100g: 1,
      fiberPer100g: 2,
    });
  }
  assert.equal((await source.listFoods()).length, 100);
  const serialized = await source.exportFoodLibrary();
  const exported = JSON.parse(serialized);
  assert.equal(exported.foods.length, 124);

  const destination = createLocalStore(new MemoryStorage());
  await destination.listFoods();
  const conflictingId = await destination.createFood({
    name: 'Different destination food',
    category: 'other',
    caloriesPer100g: 150,
    proteinPer100g: 8,
    carbsPer100g: 20,
    fatPer100g: 2,
    fiberPer100g: 3,
  });
  assert.equal(conflictingId.id, exported.foods.find((food: { id: number; name: string }) => food.name === 'Food export 000').id);

  const preview = await destination.previewFoodLibraryImport(serialized);
  assert.equal(preview.incomingCount, 124);
  assert.equal(preview.currentCount, 24);
  assert.equal(preview.newCount, 101);
  assert.equal(preview.duplicateCount, 23);
  const result = await destination.importFoodLibrary(serialized);
  assert.deepEqual(result, { incomingCount: 124, imported: 101, skippedDuplicates: 23 });
  const imported = (await destination.listFoods({ search: 'Food export 000' }))[0];
  assert.notEqual(imported.id, conflictingId.id);
  assert.equal((await destination.listFoods({ search: 'Different destination food' }))[0].caloriesPer100g, 150);
  assert.deepEqual(await destination.importFoodLibrary(serialized), {
    incomingCount: 124,
    imported: 0,
    skippedDuplicates: 124,
  });
});

test('person planner files include linked records and foods, remap IDs, and leave other plans unchanged', async () => {
  const source = createLocalStore(new MemoryStorage());
  const sourcePerson = (await source.listPeople())[0];
  await source.updatePerson(sourcePerson.id, { nutritionGoal: 'weight_loss' });
  const otherPerson = await source.createPerson(baselinePerson('Other source person'));
  const transferFood = await source.createFood({
    name: 'Food linked to one person',
    category: 'other',
    caloriesPer100g: 105,
    proteinPer100g: 6,
    carbsPer100g: 15,
    fatPer100g: 2,
    fiberPer100g: 3,
  });
  const unrelatedFood = await source.createFood({
    name: 'Food linked to another person',
    category: 'other',
    caloriesPer100g: 115,
    proteinPer100g: 7,
    carbsPer100g: 16,
    fatPer100g: 2,
    fiberPer100g: 3,
  });
  const date = '2020-02-20';
  await source.createMealEntry({ date, personId: sourcePerson.id, meal: 'lunch', foodId: transferFood.id, grams: 150 });
  await source.createMealEntry({ date, personId: otherPerson.id, meal: 'dinner', foodId: unrelatedFood.id, grams: 90 });
  await source.saveDayActivity({ date, personId: sourcePerson.id, activityType: 'training_60' });
  await source.saveMealTime({ date, personId: sourcePerson.id, meal: 'lunch', time: '12:30' });
  await source.createHeightRecord({ date, personId: sourcePerson.id, heightCm: 165 });

  const serialized = await source.exportPersonPlanner(sourcePerson.id);
  const file = JSON.parse(serialized);
  assert.equal(file.format, 'clear-access-person-planner');
  assert.equal(file.data.people.length, 1);
  assert.equal(file.data.foods.length, 1);
  assert.equal(file.data.foods[0].name, transferFood.name);
  assert.equal(file.data.entries.length, 1);
  assert.equal(file.data.activities.length, 1);
  assert.equal(file.data.heightRecords.length, 1);

  const destination = createLocalStore(new MemoryStorage());
  const existingPerson = (await destination.listPeople())[0];
  const collisionFood = await destination.createFood({
    name: 'Unrelated destination food',
    category: 'other',
    caloriesPer100g: 190,
    proteinPer100g: 8,
    carbsPer100g: 22,
    fatPer100g: 4,
    fiberPer100g: 5,
  });
  assert.equal(collisionFood.id, transferFood.id);
  await destination.createMealEntry({
    date: '2020-02-21', personId: existingPerson.id, meal: 'breakfast', foodId: collisionFood.id, grams: 100,
  });
  await destination.saveDayActivity({ date: '2020-02-21', personId: existingPerson.id, activityType: 'rest' });

  const preview = await destination.previewPersonPlannerImport(serialized);
  assert.equal(preview.personName, sourcePerson.name);
  assert.equal(preview.nameConflict, true);
  assert.equal(preview.suggestedName, 'Me (Imported)');
  assert.equal(preview.foods, 1);
  assert.equal(preview.entries, 1);
  assert.equal(preview.activities, 1);
  assert.equal(preview.heightRecords, 1);

  const result = await destination.importPersonPlanner(serialized, preview.suggestedName);
  assert.equal(result.person.isDefault, false);
  assert.equal(result.person.name, 'Me (Imported)');
  assert.equal(result.person.nutritionGoal, 'weight_loss');
  assert.deepEqual({
    foodsImported: result.foodsImported,
    entriesImported: result.entriesImported,
    activitiesImported: result.activitiesImported,
    heightRecordsImported: result.heightRecordsImported,
  }, { foodsImported: 1, entriesImported: 1, activitiesImported: 1, heightRecordsImported: 1 });

  const importedEntries = await destination.listMealEntries({ date, personId: result.person.id });
  assert.equal(importedEntries.length, 1);
  assert.equal(importedEntries[0].food.name, transferFood.name);
  assert.notEqual(importedEntries[0].food.id, transferFood.id);
  assert.equal((await destination.getDayActivity({ date, personId: result.person.id })).activityType, 'training_60');
  assert.equal((await destination.getDayActivity({ date, personId: result.person.id })).mealTimes?.lunch, '12:30');
  assert.equal((await destination.listHeightRecords({ personId: result.person.id }))[0].heightCm, 165);

  const untouchedEntries = await destination.listMealEntries({ date: '2020-02-21', personId: existingPerson.id });
  assert.equal(untouchedEntries.length, 1);
  assert.equal(untouchedEntries[0].food.name, 'Unrelated destination food');
  assert.equal(untouchedEntries[0].food.caloriesPer100g, 190);
});

test('food imports reject malformed files and preserve finite historical nutrition values atomically', async () => {
  const source = createLocalStore(new MemoryStorage());
  const file = JSON.parse(await source.exportFoodLibrary());
  file.foods[0].calciumMgPer100g = 15_000;
  file.foods[0].ironMgPer100g = 1_500;
  const serialized = JSON.stringify(file);

  const storage = new MemoryStorage();
  const destination = createLocalStore(storage);
  await destination.listFoods();
  const before = await destination.exportForTests();
  const malformed = JSON.parse(serialized);
  malformed.foods[0].caloriesPer100g = 'not a number';
  await assert.rejects(destination.previewFoodLibraryImport(JSON.stringify(malformed)), /invalid food record/i);
  assert.deepEqual(await destination.exportForTests(), before);

  storage.failNextWrite = true;
  await assert.rejects(destination.importFoodLibrary(serialized), /change was not applied/i);
  assert.deepEqual(await destination.exportForTests(), before);
  await destination.importFoodLibrary(serialized);
  const historical = (await destination.listFoods({ search: file.foods[0].name }))
    .find(food => food.calciumMgPer100g === 15_000);
  assert.equal(historical?.ironMgPer100g, 1_500);
});
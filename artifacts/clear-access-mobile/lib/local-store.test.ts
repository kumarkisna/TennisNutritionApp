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
    const { dateOfBirth: _dob, growthReferenceSex: _sex, ...legacyPerson } = person;
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
  assert.equal(migrated.version, 2);
  assert.equal(migrated.nextPersonId, current.nextPersonId);
  assert.equal(migrated.nextFoodId, current.nextFoodId);
  assert.equal(migrated.nextEntryId, current.nextEntryId);
  assert.equal((await createLocalStore(storage).createPerson(baselinePerson('After migration'))).id, current.nextPersonId);
  assert.equal(people.find(person => person.id === defaultPerson.id)?.isDefault, true);
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
  const noWeight = await store.createPerson({ ...baselinePerson('Summary no weight'), ageYears: 25 });
  const under18 = await store.createPerson({ ...baselinePerson('Summary under eighteen'), weightKg: 70, ageYears: 17 });
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
  await assert.rejects(store.deleteFood(reference.id), /only custom foods/i);
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
  await assert.rejects(store.deleteFood(reference.id), /only custom foods/i);
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
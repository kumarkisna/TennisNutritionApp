// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by this direct store regression suite.
import test from 'node:test';
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
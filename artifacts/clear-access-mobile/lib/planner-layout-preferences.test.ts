// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import {
  createPlannerLayoutPreferences,
  PLANNER_LAYOUT_STORAGE_KEY,
  LEGACY_PLANNER_LAYOUT_STORAGE_KEY,
  PREVIOUS_PLANNER_LAYOUT_STORAGE_KEY,
  DEFAULT_PLANNER_LAYOUT,
  type PlannerLayoutStorage,
} from './planner-layout-preferences';

class MemoryStorage implements PlannerLayoutStorage {
  values = new Map<string, string>();
  failWrite = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Device storage is unavailable');
    this.values.set(key, value);
  }
}

test('fresh devices use the original order and do not write storage', async () => {
  const storage = new MemoryStorage();
  storage.values.set('clear-access-mobile:planner:v1', 'planner records stay untouched');
  assert.deepEqual(await createPlannerLayoutPreferences(storage).load(), DEFAULT_PLANNER_LAYOUT);
  assert.equal(storage.values.size, 1);
});

test('layout and section positions persist independently of planner records', async () => {
  const storage = new MemoryStorage();
  const plannerBytes = '{"saved":"people, meals and foods"}';
  storage.values.set('clear-access-mobile:planner:v1', plannerBytes);
  const preferences = createPlannerLayoutPreferences(storage);
  const choice = {
    mode: 'compact' as const,
    dayTotalsPosition: 'last' as const,
    plannedPortionsPosition: 'first' as const,
    sleepLogPosition: 'last' as const,
    tennisPlanPosition: 'after' as const,
  };
  await preferences.save(choice);
  assert.deepEqual(await preferences.load(), choice);
  assert.equal(storage.values.get('clear-access-mobile:planner:v1'), plannerBytes);
});

test('v1 layout choice migrates with the original order as the default', async () => {
  const storage = new MemoryStorage();
  storage.values.set(LEGACY_PLANNER_LAYOUT_STORAGE_KEY, '{"version":1,"mode":"compact"}');
  assert.deepEqual(await createPlannerLayoutPreferences(storage).load(), { ...DEFAULT_PLANNER_LAYOUT, mode: 'compact' });
  assert.equal(storage.values.has(PLANNER_LAYOUT_STORAGE_KEY), false);
});

test('v2 layout choice keeps existing positions and adds the new sleep position default', async () => {
  const storage = new MemoryStorage();
  storage.values.set(PREVIOUS_PLANNER_LAYOUT_STORAGE_KEY, JSON.stringify({
    version: 2,
    mode: 'compact',
    dayTotalsPosition: 'last',
    plannedPortionsPosition: 'first',
    tennisPlanPosition: 'after',
  }));
  assert.deepEqual(await createPlannerLayoutPreferences(storage).load(), {
    ...DEFAULT_PLANNER_LAYOUT,
    mode: 'compact',
    dayTotalsPosition: 'last',
    plannedPortionsPosition: 'first',
    tennisPlanPosition: 'after',
  });
});

test('unsupported layout preferences fail without rewriting stored bytes', async () => {
  const storage = new MemoryStorage();
  for (const serialized of [
    'broken JSON',
    'null',
    '{"version":1,"mode":"compact"}',
    '{"version":2,"mode":"compact","dayTotalsPosition":"later","plannedPortionsPosition":"first","tennisPlanPosition":"before"}',
  ]) {
    storage.values.set(PLANNER_LAYOUT_STORAGE_KEY, serialized);
    await assert.rejects(createPlannerLayoutPreferences(storage).load(), /Planner layout/i);
    assert.equal(storage.values.get(PLANNER_LAYOUT_STORAGE_KEY), serialized);
  }
  await assert.rejects(createPlannerLayoutPreferences(storage).save({ ...DEFAULT_PLANNER_LAYOUT, plannedPortionsPosition: 'hidden' as never }), /supported Planner layout/i);
});

test('failed layout saves do not change the durable choice', async () => {
  const storage = new MemoryStorage();
  const preferences = createPlannerLayoutPreferences(storage);
  await preferences.save(DEFAULT_PLANNER_LAYOUT);
  storage.failWrite = true;
  await assert.rejects(preferences.save({ ...DEFAULT_PLANNER_LAYOUT, mode: 'compact' }), /Device storage is unavailable/);
  storage.failWrite = false;
  assert.deepEqual(await preferences.load(), DEFAULT_PLANNER_LAYOUT);
});

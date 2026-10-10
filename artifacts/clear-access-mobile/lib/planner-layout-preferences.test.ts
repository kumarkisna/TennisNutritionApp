// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import {
  createPlannerLayoutPreferences,
  PLANNER_LAYOUT_STORAGE_KEY,
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

test('fresh devices keep the current Planner layout without writing storage', async () => {
  const storage = new MemoryStorage();
  storage.values.set('clear-access-mobile:planner:v1', 'planner records stay untouched');
  assert.equal(await createPlannerLayoutPreferences(storage).load(), 'current');
  assert.equal(storage.values.size, 1);
});

test('current and compact Planner layouts persist independently of planner records', async () => {
  const storage = new MemoryStorage();
  const plannerBytes = '{"saved":"people, meals and foods"}';
  storage.values.set('clear-access-mobile:planner:v1', plannerBytes);
  const preferences = createPlannerLayoutPreferences(storage);
  for (const mode of ['current', 'compact'] as const) {
    await preferences.save(mode);
    assert.equal(await preferences.load(), mode);
    assert.equal(storage.values.get('clear-access-mobile:planner:v1'), plannerBytes);
  }
});

test('unsupported layout preferences fail without rewriting stored bytes', async () => {
  const storage = new MemoryStorage();
  for (const serialized of ['broken JSON', 'null', '{"version":2,"mode":"compact"}', '{"version":1,"mode":"unknown"}']) {
    storage.values.set(PLANNER_LAYOUT_STORAGE_KEY, serialized);
    await assert.rejects(createPlannerLayoutPreferences(storage).load(), /Planner layout/i);
    assert.equal(storage.values.get(PLANNER_LAYOUT_STORAGE_KEY), serialized);
  }
  await assert.rejects(createPlannerLayoutPreferences(storage).save('hidden' as never), /supported Planner layout/i);
});

test('failed layout saves do not change the durable choice', async () => {
  const storage = new MemoryStorage();
  const preferences = createPlannerLayoutPreferences(storage);
  await preferences.save('current');
  storage.failWrite = true;
  await assert.rejects(preferences.save('compact'), /Device storage is unavailable/);
  storage.failWrite = false;
  assert.equal(await preferences.load(), 'current');
});

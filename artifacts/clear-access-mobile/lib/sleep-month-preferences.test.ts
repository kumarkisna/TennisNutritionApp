// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { createSleepMonthPreferences, SLEEP_MONTH_PREFERENCES_KEY, type SleepMonthPreferencesStorage } from './sleep-month-preferences';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SLEEP_MONTH_PREFERENCES_KEY, initial);
  const storage: SleepMonthPreferencesStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  return { values, storage };
}

test('sleep month selections persist independently for each person', async () => {
  const { storage } = memoryStorage();
  const preferences = createSleepMonthPreferences(storage);
  assert.equal(await preferences.load(1), null);
  await preferences.save(1, { month: '2026-03', comparisonMonth: '2025-11' });
  await preferences.save(2, { month: '2024-08', comparisonMonth: '2023-12' });
  assert.deepEqual(await preferences.load(1), { month: '2026-03', comparisonMonth: '2025-11' });
  assert.deepEqual(await preferences.load(2), { month: '2024-08', comparisonMonth: '2023-12' });
});

test('unsupported or corrupted month preferences fail explicitly and preserve stored bytes', async () => {
  for (const serialized of ['{', '{"version":1,"people":{"4":{"month":"2026-13","comparisonMonth":"2026-01"}}}']) {
    const { storage, values } = memoryStorage(serialized);
    const preferences = createSleepMonthPreferences(storage);
    await assert.rejects(preferences.load(4), /sleep month selections/i);
    await assert.rejects(preferences.save(5, { month: '2026-05', comparisonMonth: '2026-01' }), /sleep month selections/i);
    assert.equal(values.get(SLEEP_MONTH_PREFERENCES_KEY), serialized);
  }
});

test('invalid people and invalid selected months cannot be saved', async () => {
  const preferences = createSleepMonthPreferences(memoryStorage().storage);
  await assert.rejects(preferences.load(0), /valid person/i);
  await assert.rejects(preferences.save(-1, { month: '2026-02', comparisonMonth: '2026-01' }), /valid person/i);
  await assert.rejects(preferences.save(1, { month: '2026-00', comparisonMonth: '2026-01' }), /valid months/i);
});

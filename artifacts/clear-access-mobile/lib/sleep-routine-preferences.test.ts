// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import {
  createSleepRoutinePreferences,
  SLEEP_ROUTINE_PREFERENCES_KEY,
  type SleepRoutinePreferencesStorage,
} from './sleep-routine-preferences';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SLEEP_ROUTINE_PREFERENCES_KEY, initial);
  const storage: SleepRoutinePreferencesStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  return { values, storage };
}

test('sleep routines persist separately for each person and can be updated', async () => {
  const { storage } = memoryStorage();
  const preferences = createSleepRoutinePreferences(storage);
  assert.equal(await preferences.load(1), null);
  await preferences.save(1, { bedtime: '22:30', wakeTime: '06:45' });
  await preferences.save(2, { bedtime: '21:15', wakeTime: '07:00' });
  await preferences.save(1, { bedtime: '23:00', wakeTime: '07:30' });
  assert.deepEqual(await preferences.load(1), { bedtime: '23:00', wakeTime: '07:30' });
  assert.deepEqual(await preferences.load(2), { bedtime: '21:15', wakeTime: '07:00' });
});

test('invalid people and clock times cannot be saved', async () => {
  const preferences = createSleepRoutinePreferences(memoryStorage().storage);
  await assert.rejects(preferences.load(0), /valid person/i);
  await assert.rejects(preferences.save(-1, { bedtime: '22:30', wakeTime: '06:45' }), /valid person/i);
  await assert.rejects(preferences.save(1, { bedtime: '24:00', wakeTime: '06:45' }), /valid bedtime/i);
  await assert.rejects(preferences.save(1, { bedtime: '22:30', wakeTime: '' }), /valid bedtime/i);
});

test('corrupted or unsupported routines fail explicitly without replacing stored data', async () => {
  for (const serialized of ['{', '{"version":1,"people":{"4":{"bedtime":"25:00","wakeTime":"06:45"}}}']) {
    const { storage, values } = memoryStorage(serialized);
    const preferences = createSleepRoutinePreferences(storage);
    await assert.rejects(preferences.load(4), /sleep routines/i);
    await assert.rejects(preferences.save(5, { bedtime: '22:30', wakeTime: '06:45' }), /sleep routines/i);
    assert.equal(values.get(SLEEP_ROUTINE_PREFERENCES_KEY), serialized);
  }
});

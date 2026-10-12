import { isClockTime } from './tennis-planning';
import type { SleepTimes } from './sleep-tracking';

export const SLEEP_ROUTINE_PREFERENCES_KEY = 'clear-access-mobile:sleep-routines:v1';

export type SleepRoutinePreferencesStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function parsePreferences(serialized: string) {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('Saved sleep routines could not be read.'); }
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 ||
    !('people' in value) || typeof value.people !== 'object' || value.people === null || Array.isArray(value.people)) {
    throw new Error('Saved sleep routines are unsupported.');
  }
  const people: Record<string, SleepTimes> = {};
  for (const [personId, routine] of Object.entries(value.people)) {
    if (!/^[1-9]\d*$/.test(personId) || !Number.isSafeInteger(Number(personId)) ||
      typeof routine !== 'object' || routine === null ||
      !('bedtime' in routine) || !isClockTime(routine.bedtime) ||
      !('wakeTime' in routine) || !isClockTime(routine.wakeTime)) {
      throw new Error('Saved sleep routines are unsupported.');
    }
    people[personId] = { bedtime: routine.bedtime, wakeTime: routine.wakeTime };
  }
  return { version: 1 as const, people };
}

export function createSleepRoutinePreferences(storage: SleepRoutinePreferencesStorage) {
  let pending: Promise<void> = Promise.resolve();
  const read = async () => {
    const serialized = await storage.getItem(SLEEP_ROUTINE_PREFERENCES_KEY);
    return serialized === null
      ? { version: 1 as const, people: {} as Record<string, SleepTimes> }
      : parsePreferences(serialized);
  };
  return {
    load(personId: number): Promise<SleepTimes | null> {
      if (!Number.isSafeInteger(personId) || personId < 1) return Promise.reject(new Error('Choose a valid person.'));
      return pending.then(async () => (await read()).people[String(personId)] ?? null);
    },
    save(personId: number, routine: SleepTimes): Promise<void> {
      if (!Number.isSafeInteger(personId) || personId < 1) return Promise.reject(new Error('Choose a valid person.'));
      if (!isClockTime(routine.bedtime) || !isClockTime(routine.wakeTime)) {
        return Promise.reject(new Error('Enter a valid bedtime and wake time before saving the routine.'));
      }
      const write = pending.then(async () => {
        const preferences = await read();
        preferences.people[String(personId)] = { bedtime: routine.bedtime, wakeTime: routine.wakeTime };
        await storage.setItem(SLEEP_ROUTINE_PREFERENCES_KEY, JSON.stringify(preferences));
      });
      pending = write.catch(() => {});
      return write;
    },
  };
}

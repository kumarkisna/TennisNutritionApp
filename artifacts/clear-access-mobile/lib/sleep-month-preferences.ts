export const SLEEP_MONTH_PREFERENCES_KEY = 'clear-access-mobile:sleep-month-selections:v1';

export type SleepMonthSelection = { month: string; comparisonMonth: string };
export type SleepMonthPreferencesStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parsePreferences(serialized: string) {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('Saved sleep month selections could not be read.'); }
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 ||
    !('people' in value) || typeof value.people !== 'object' || value.people === null || Array.isArray(value.people)) {
    throw new Error('Saved sleep month selections are unsupported.');
  }
  const people: Record<string, SleepMonthSelection> = {};
  for (const [personId, selection] of Object.entries(value.people)) {
    if (!/^[1-9]\d*$/.test(personId) || typeof selection !== 'object' || selection === null ||
      !('month' in selection) || !isMonth(selection.month) ||
      !('comparisonMonth' in selection) || !isMonth(selection.comparisonMonth)) {
      throw new Error('Saved sleep month selections are unsupported.');
    }
    people[personId] = { month: selection.month, comparisonMonth: selection.comparisonMonth };
  }
  return { version: 1 as const, people };
}

export function createSleepMonthPreferences(storage: SleepMonthPreferencesStorage) {
  let pending: Promise<void> = Promise.resolve();
  const read = async () => {
    const serialized = await storage.getItem(SLEEP_MONTH_PREFERENCES_KEY);
    return serialized === null ? { version: 1 as const, people: {} as Record<string, SleepMonthSelection> } : parsePreferences(serialized);
  };
  return {
    load(personId: number): Promise<SleepMonthSelection | null> {
      if (!Number.isInteger(personId) || personId < 1) return Promise.reject(new Error('Choose a valid person.'));
      return pending.then(async () => (await read()).people[String(personId)] ?? null);
    },
    save(personId: number, selection: SleepMonthSelection): Promise<void> {
      if (!Number.isInteger(personId) || personId < 1) return Promise.reject(new Error('Choose a valid person.'));
      if (!isMonth(selection.month) || !isMonth(selection.comparisonMonth)) {
        return Promise.reject(new Error('Choose valid months for the sleep comparison.'));
      }
      const write = pending.then(async () => {
        const preferences = await read();
        preferences.people[String(personId)] = selection;
        await storage.setItem(SLEEP_MONTH_PREFERENCES_KEY, JSON.stringify(preferences));
      });
      pending = write.catch(() => {});
      return write;
    },
  };
}

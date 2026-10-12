import type { MealReviewSort } from './meal-review-sort';

export type MealHistoryPreferences = {
  minimumRating: number | null;
  sort: MealReviewSort;
};

export type MealHistoryPreferencesState = {
  byPerson: Record<string, MealHistoryPreferences>;
  legacyDefault: MealHistoryPreferences | null;
};

export const DEFAULT_MEAL_HISTORY_PREFERENCES: MealHistoryPreferences = {
  minimumRating: null,
  sort: 'recent',
};

export const DEFAULT_MEAL_HISTORY_PREFERENCES_STATE: MealHistoryPreferencesState = {
  byPerson: {},
  legacyDefault: null,
};

export type MealHistoryPreferencesStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function mealHistoryPreferencesForPerson(state: MealHistoryPreferencesState, personId: number): MealHistoryPreferences {
  return state.byPerson[String(personId)] ?? state.legacyDefault ?? DEFAULT_MEAL_HISTORY_PREFERENCES;
}

export function updateMealHistoryPreferencesForPerson(
  state: MealHistoryPreferencesState,
  personId: number,
  changes: Partial<MealHistoryPreferences>,
): MealHistoryPreferencesState {
  if (!Number.isSafeInteger(personId) || personId < 1) throw new Error('Choose a valid person for meal-history filters.');
  const id = String(personId);
  return {
    ...state,
    byPerson: {
      ...state.byPerson,
      [id]: { ...mealHistoryPreferencesForPerson(state, personId), ...changes },
    },
  };
}

function isMealHistoryPreferences(value: unknown): value is MealHistoryPreferences {
  return typeof value === 'object' && value !== null &&
    'minimumRating' in value && (value.minimumRating === null ||
      (typeof value.minimumRating === 'number' && Number.isInteger(value.minimumRating) && value.minimumRating >= 1 && value.minimumRating <= 10)) &&
    'sort' in value && (value.sort === 'recent' || value.sort === 'rating');
}

function isPreferencesState(value: unknown): value is { version: 2 } & MealHistoryPreferencesState {
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 2 ||
    !('byPerson' in value) || typeof value.byPerson !== 'object' || value.byPerson === null || Array.isArray(value.byPerson) ||
    !('legacyDefault' in value) || (value.legacyDefault !== null && !isMealHistoryPreferences(value.legacyDefault))) return false;
  return Object.entries(value.byPerson).every(([personId, preferences]) =>
    /^[1-9]\d*$/.test(personId) && Number.isSafeInteger(Number(personId)) && isMealHistoryPreferences(preferences));
}

function isLegacyPreferences(value: unknown): value is { version: 1 } & MealHistoryPreferences {
  return typeof value === 'object' && value !== null &&
    'version' in value && value.version === 1 && isMealHistoryPreferences(value);
}

function parseSavedValue(serialized: string): unknown {
  try { return JSON.parse(serialized); }
  catch { throw new Error('The saved meal-history filters could not be read.'); }
}

export const MEAL_HISTORY_PREFERENCES_KEY = 'clear-access-mobile:meal-history-filters:v2';
export const LEGACY_MEAL_HISTORY_PREFERENCES_KEY = 'clear-access-mobile:meal-history-filters:v1';

export function createMealHistoryPreferences(storage: MealHistoryPreferencesStorage) {
  return {
    async load(): Promise<MealHistoryPreferencesState> {
      const serialized = await storage.getItem(MEAL_HISTORY_PREFERENCES_KEY);
      if (serialized !== null) {
        const value = parseSavedValue(serialized);
        if (!isPreferencesState(value)) throw new Error('The saved meal-history filters are unsupported.');
        return { byPerson: value.byPerson, legacyDefault: value.legacyDefault };
      }
      const legacySerialized = await storage.getItem(LEGACY_MEAL_HISTORY_PREFERENCES_KEY);
      if (legacySerialized === null) return DEFAULT_MEAL_HISTORY_PREFERENCES_STATE;
      const legacyValue = parseSavedValue(legacySerialized);
      if (!isLegacyPreferences(legacyValue)) throw new Error('The saved meal-history filters are unsupported.');
      return {
        byPerson: {},
        legacyDefault: { minimumRating: legacyValue.minimumRating, sort: legacyValue.sort },
      };
    },
    async save(state: MealHistoryPreferencesState): Promise<void> {
      const value = { version: 2, ...state };
      if (!isPreferencesState(value)) throw new Error('Choose valid per-person meal-history filters.');
      await storage.setItem(MEAL_HISTORY_PREFERENCES_KEY, JSON.stringify(value));
    },
  };
}

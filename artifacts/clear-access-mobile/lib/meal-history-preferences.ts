import type { MealReviewSort } from './meal-review-sort';

export const MEAL_HISTORY_PREFERENCES_KEY = 'clear-access-mobile:meal-history-filters:v1';

export type MealHistoryPreferences = {
  minimumRating: number | null;
  sort: MealReviewSort;
};

export const DEFAULT_MEAL_HISTORY_PREFERENCES: MealHistoryPreferences = {
  minimumRating: null,
  sort: 'recent',
};

export type MealHistoryPreferencesStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isPreferences(value: unknown): value is { version: 1 } & MealHistoryPreferences {
  return typeof value === 'object' && value !== null &&
    'version' in value && value.version === 1 &&
    'minimumRating' in value && (value.minimumRating === null ||
      (typeof value.minimumRating === 'number' && Number.isInteger(value.minimumRating) && value.minimumRating >= 1 && value.minimumRating <= 10)) &&
    'sort' in value && (value.sort === 'recent' || value.sort === 'rating');
}

export function createMealHistoryPreferences(storage: MealHistoryPreferencesStorage) {
  return {
    async load(): Promise<MealHistoryPreferences> {
      const serialized = await storage.getItem(MEAL_HISTORY_PREFERENCES_KEY);
      if (serialized === null) return DEFAULT_MEAL_HISTORY_PREFERENCES;
      let value: unknown;
      try { value = JSON.parse(serialized); }
      catch { throw new Error('The saved meal-history filters could not be read.'); }
      if (!isPreferences(value)) throw new Error('The saved meal-history filters are unsupported.');
      return { minimumRating: value.minimumRating, sort: value.sort };
    },
    async save(preferences: MealHistoryPreferences): Promise<void> {
      if (preferences.minimumRating !== null &&
        (!Number.isInteger(preferences.minimumRating) || preferences.minimumRating < 1 || preferences.minimumRating > 10)) {
        throw new Error('Choose a minimum rating from 1 to 10, or no minimum.');
      }
      if (preferences.sort !== 'recent' && preferences.sort !== 'rating') {
        throw new Error('Choose a supported meal-history sort order.');
      }
      await storage.setItem(MEAL_HISTORY_PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences }));
    },
  };
}

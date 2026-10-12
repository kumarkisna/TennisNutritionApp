import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMealHistoryPreferences,
  DEFAULT_MEAL_HISTORY_PREFERENCES_STATE,
  mealHistoryPreferencesForPerson,
  updateMealHistoryPreferencesForPerson,
  type MealHistoryPreferencesState,
  type MealHistoryPreferences,
} from '@/lib/meal-history-preferences';

const preferences = createMealHistoryPreferences(AsyncStorage);
type MealHistoryPreferencesContextValue = {
  preferences: MealHistoryPreferencesState;
  loading: boolean;
  error: string | null;
  updateSettings: (personId: number, changes: Partial<MealHistoryPreferences>) => Promise<boolean>;
};
const MealHistoryPreferencesContext = createContext<MealHistoryPreferencesContextValue | null>(null);

export function MealHistoryPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferenceState, setPreferenceState] = useState(DEFAULT_MEAL_HISTORY_PREFERENCES_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<MealHistoryPreferencesState>(DEFAULT_MEAL_HISTORY_PREFERENCES_STATE);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    preferences.load().then(saved => {
      if (active) {
        current.current = saved;
        setPreferenceState(saved);
      }
    }).catch(problem => {
      if (active) setError(`Could not load saved meal-history filters. ${problem instanceof Error ? problem.message : String(problem)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function updateSettings(personId: number, changes: Partial<MealHistoryPreferences>) {
    if (loading) return false;
    const next = updateMealHistoryPreferencesForPerson(current.current, personId, changes);
    current.current = next;
    setPreferenceState(next);
    setError(null);
    const write = writeQueue.current.catch(() => undefined).then(() => preferences.save(next));
    writeQueue.current = write;
    try {
      await write;
      return true;
    } catch (problem) {
      setError(`Could not save meal-history filters. ${problem instanceof Error ? problem.message : String(problem)}`);
      return false;
    }
  }

  return <MealHistoryPreferencesContext.Provider value={{ preferences: preferenceState, loading, error, updateSettings }}>
    {children}
  </MealHistoryPreferencesContext.Provider>;
}

export function useMealHistoryPreferences(personId: number) {
  const value = useContext(MealHistoryPreferencesContext);
  if (!value) throw new Error('MealHistoryPreferencesProvider is required for these filters.');
  return {
    settings: mealHistoryPreferencesForPerson(value.preferences, personId),
    loading: value.loading,
    error: value.error,
    updateSettings: (changes: Partial<MealHistoryPreferences>) => value.updateSettings(personId, changes),
  };
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMealHistoryPreferences,
  DEFAULT_MEAL_HISTORY_PREFERENCES,
  type MealHistoryPreferences,
} from '@/lib/meal-history-preferences';

const preferences = createMealHistoryPreferences(AsyncStorage);
type MealHistoryPreferencesContextValue = {
  settings: MealHistoryPreferences;
  loading: boolean;
  error: string | null;
  updateSettings: (changes: Partial<MealHistoryPreferences>) => Promise<boolean>;
};
const MealHistoryPreferencesContext = createContext<MealHistoryPreferencesContextValue | null>(null);

export function MealHistoryPreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_MEAL_HISTORY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<MealHistoryPreferences>(DEFAULT_MEAL_HISTORY_PREFERENCES);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    preferences.load().then(saved => {
      if (active) {
        current.current = saved;
        setSettings(saved);
      }
    }).catch(problem => {
      if (active) setError(`Could not load saved meal-history filters. ${problem instanceof Error ? problem.message : String(problem)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function updateSettings(changes: Partial<MealHistoryPreferences>) {
    if (loading) return false;
    const next = { ...current.current, ...changes };
    current.current = next;
    setSettings(next);
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

  return <MealHistoryPreferencesContext.Provider value={{ settings, loading, error, updateSettings }}>
    {children}
  </MealHistoryPreferencesContext.Provider>;
}

export function useMealHistoryPreferences() {
  const value = useContext(MealHistoryPreferencesContext);
  if (!value) throw new Error('MealHistoryPreferencesProvider is required for these filters.');
  return value;
}

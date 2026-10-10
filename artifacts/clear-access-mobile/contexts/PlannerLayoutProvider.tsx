import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPlannerLayoutPreferences,
  DEFAULT_PLANNER_LAYOUT,
  type PlannerLayoutPreferences,
} from '@/lib/planner-layout-preferences';

const preferences = createPlannerLayoutPreferences(AsyncStorage);
type PlannerLayoutContextValue = {
  settings: PlannerLayoutPreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateSettings: (changes: Partial<PlannerLayoutPreferences>) => Promise<boolean>;
};
const PlannerLayoutContext = createContext<PlannerLayoutContextValue | null>(null);

export function PlannerLayoutProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlannerLayoutPreferences>(DEFAULT_PLANNER_LAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    preferences.load().then(savedSettings => {
      if (active) setSettings(savedSettings);
    }).catch(problem => {
      if (active) setError(`Could not load the Planner layout choice: ${problem instanceof Error ? problem.message : String(problem)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function updateSettings(changes: Partial<PlannerLayoutPreferences>) {
    if (busy.current || loading) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    const next = { ...settings, ...changes };
    try {
      await preferences.save(next);
      setSettings(next);
      return true;
    } catch (problem) {
      setError(`Could not save these Planner settings; the current choices were kept. ${problem instanceof Error ? problem.message : String(problem)}`);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <PlannerLayoutContext.Provider value={{ settings, loading, saving, error, updateSettings }}>
    {children}
  </PlannerLayoutContext.Provider>;
}

export function usePlannerLayout() {
  const value = useContext(PlannerLayoutContext);
  if (!value) throw new Error('PlannerLayoutProvider is required for this preference.');
  return value;
}

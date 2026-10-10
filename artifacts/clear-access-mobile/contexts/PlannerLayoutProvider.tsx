import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPlannerLayoutPreferences,
  type PlannerLayoutMode,
} from '@/lib/planner-layout-preferences';

const preferences = createPlannerLayoutPreferences(AsyncStorage);
type PlannerLayoutContextValue = {
  mode: PlannerLayoutMode;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectMode: (mode: PlannerLayoutMode) => Promise<boolean>;
};
const PlannerLayoutContext = createContext<PlannerLayoutContextValue | null>(null);

export function PlannerLayoutProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PlannerLayoutMode>('current');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    preferences.load().then(savedMode => {
      if (active) setMode(savedMode);
    }).catch(problem => {
      if (active) setError(`Could not load the Planner layout choice: ${problem instanceof Error ? problem.message : String(problem)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function selectMode(nextMode: PlannerLayoutMode) {
    if (busy.current || loading) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await preferences.save(nextMode);
      setMode(nextMode);
      return true;
    } catch (problem) {
      setError(`Could not save this Planner layout; the current choice was kept. ${problem instanceof Error ? problem.message : String(problem)}`);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <PlannerLayoutContext.Provider value={{ mode, loading, saving, error, selectMode }}>
    {children}
  </PlannerLayoutContext.Provider>;
}

export function usePlannerLayout() {
  const value = useContext(PlannerLayoutContext);
  if (!value) throw new Error('PlannerLayoutProvider is required for this preference.');
  return value;
}

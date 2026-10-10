export const PLANNER_LAYOUT_STORAGE_KEY = 'clear-access-mobile:planner-layout:v3';
export const LEGACY_PLANNER_LAYOUT_STORAGE_KEY = 'clear-access-mobile:planner-layout:v1';
export const PREVIOUS_PLANNER_LAYOUT_STORAGE_KEY = 'clear-access-mobile:planner-layout:v2';
export type PlannerLayoutMode = 'current' | 'compact';
export type PlannerSectionPosition = 'first' | 'last';
export type TennisPlanPosition = 'before' | 'after';
export type PlannerLayoutPreferences = {
  mode: PlannerLayoutMode;
  dayTotalsPosition: PlannerSectionPosition;
  plannedPortionsPosition: PlannerSectionPosition;
  sleepLogPosition: PlannerSectionPosition;
  tennisPlanPosition: TennisPlanPosition;
};
export const DEFAULT_PLANNER_LAYOUT: PlannerLayoutPreferences = {
  mode: 'current',
  dayTotalsPosition: 'first',
  plannedPortionsPosition: 'last',
  sleepLogPosition: 'first',
  tennisPlanPosition: 'before',
};
export type PlannerLayoutStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isPreferences(value: unknown): value is PlannerLayoutPreferences {
  return typeof value === 'object' && value !== null &&
    'version' in value && value.version === 3 &&
    'mode' in value && (value.mode === 'current' || value.mode === 'compact') &&
    'dayTotalsPosition' in value && (value.dayTotalsPosition === 'first' || value.dayTotalsPosition === 'last') &&
    'plannedPortionsPosition' in value && (value.plannedPortionsPosition === 'first' || value.plannedPortionsPosition === 'last') &&
    'sleepLogPosition' in value && (value.sleepLogPosition === 'first' || value.sleepLogPosition === 'last') &&
    'tennisPlanPosition' in value && (value.tennisPlanPosition === 'before' || value.tennisPlanPosition === 'after');
}

function migrateLegacy(serialized: string): PlannerLayoutPreferences {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('The saved Planner layout choice could not be read.'); }
  if (typeof value !== 'object' || value === null ||
    !('version' in value) || value.version !== 1 ||
    !('mode' in value) || (value.mode !== 'current' && value.mode !== 'compact')) {
    throw new Error('The saved Planner layout choice is unsupported.');
  }
  return { ...DEFAULT_PLANNER_LAYOUT, mode: value.mode };
}

function migrateV2(serialized: string): PlannerLayoutPreferences {
  let value: unknown;
  try { value = JSON.parse(serialized); }
  catch { throw new Error('The saved Planner layout choice could not be read.'); }
  if (typeof value !== 'object' || value === null ||
    !('version' in value) || value.version !== 2 ||
    !('mode' in value) || (value.mode !== 'current' && value.mode !== 'compact') ||
    !('dayTotalsPosition' in value) || (value.dayTotalsPosition !== 'first' && value.dayTotalsPosition !== 'last') ||
    !('plannedPortionsPosition' in value) || (value.plannedPortionsPosition !== 'first' && value.plannedPortionsPosition !== 'last') ||
    !('tennisPlanPosition' in value) || (value.tennisPlanPosition !== 'before' && value.tennisPlanPosition !== 'after')) {
    throw new Error('The saved Planner layout choice is unsupported.');
  }
  return {
    mode: value.mode,
    dayTotalsPosition: value.dayTotalsPosition,
    plannedPortionsPosition: value.plannedPortionsPosition,
    sleepLogPosition: DEFAULT_PLANNER_LAYOUT.sleepLogPosition,
    tennisPlanPosition: value.tennisPlanPosition,
  };
}

export function createPlannerLayoutPreferences(storage: PlannerLayoutStorage) {
  return {
    async load(): Promise<PlannerLayoutPreferences> {
      const serialized = await storage.getItem(PLANNER_LAYOUT_STORAGE_KEY);
      if (serialized !== null) {
        let value: unknown;
        try { value = JSON.parse(serialized); }
        catch { throw new Error('The saved Planner layout choice could not be read.'); }
        if (!isPreferences(value)) throw new Error('The saved Planner layout choice is unsupported.');
        return {
          mode: value.mode,
          dayTotalsPosition: value.dayTotalsPosition,
          plannedPortionsPosition: value.plannedPortionsPosition,
          sleepLogPosition: value.sleepLogPosition,
          tennisPlanPosition: value.tennisPlanPosition,
        };
      }
      const previous = await storage.getItem(PREVIOUS_PLANNER_LAYOUT_STORAGE_KEY);
      if (previous !== null) return migrateV2(previous);
      const legacy = await storage.getItem(LEGACY_PLANNER_LAYOUT_STORAGE_KEY);
      return legacy === null ? DEFAULT_PLANNER_LAYOUT : migrateLegacy(legacy);
    },
    async save(preferences: PlannerLayoutPreferences): Promise<void> {
      if (!isPreferences({ version: 3, ...preferences })) throw new Error('Choose supported Planner layout settings.');
      await storage.setItem(PLANNER_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 3, ...preferences }));
    },
  };
}

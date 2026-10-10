export const PLANNER_LAYOUT_STORAGE_KEY = 'clear-access-mobile:planner-layout:v1';
export type PlannerLayoutMode = 'current' | 'compact';
export type PlannerLayoutStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function isPlannerLayoutMode(value: unknown): value is PlannerLayoutMode {
  return value === 'current' || value === 'compact';
}

export function createPlannerLayoutPreferences(storage: PlannerLayoutStorage) {
  return {
    async load(): Promise<PlannerLayoutMode> {
      const serialized = await storage.getItem(PLANNER_LAYOUT_STORAGE_KEY);
      if (serialized === null) return 'current';
      let value: unknown;
      try { value = JSON.parse(serialized); }
      catch { throw new Error('The saved Planner layout choice could not be read.'); }
      if (typeof value !== 'object' || value === null ||
        !('version' in value) || value.version !== 1 ||
        !('mode' in value) || !isPlannerLayoutMode(value.mode)) {
        throw new Error('The saved Planner layout choice is unsupported.');
      }
      return value.mode;
    },
    async save(mode: PlannerLayoutMode): Promise<void> {
      if (!isPlannerLayoutMode(mode)) throw new Error('Choose a supported Planner layout.');
      await storage.setItem(PLANNER_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, mode }));
    },
  };
}

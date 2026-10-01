import { DEFAULT_THEME_ID, findTheme } from '../constants/colors';

// Appearance has its own namespace; it never reads or rewrites planner records/backups.
export const THEME_STORAGE_KEY = 'clear-access-mobile:appearance:v1';
export type ThemeStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function createThemePreferences(storage: ThemeStorage) {
  return {
    async load(): Promise<string> {
      const serialized = await storage.getItem(THEME_STORAGE_KEY);
      if (serialized === null) return DEFAULT_THEME_ID;
      let value: unknown;
      try { value = JSON.parse(serialized); }
      catch { throw new Error('The saved appearance setting could not be read. Planner records were not changed.'); }
      if (typeof value !== 'object' || value === null ||
        !('version' in value) || value.version !== 1 ||
        !('themeId' in value) || typeof value.themeId !== 'string' || !findTheme(value.themeId)) {
        throw new Error('The saved appearance setting is unsupported. Planner records were not changed.');
      }
      return value.themeId;
    },
    async save(themeId: string): Promise<void> {
      if (!findTheme(themeId)) throw new Error('Choose a supported theme.');
      await storage.setItem(THEME_STORAGE_KEY, JSON.stringify({ version: 1, themeId }));
    },
  };
}
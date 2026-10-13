export const SECTION_DISCLOSURE_STORAGE_PREFIX = 'clear-access-mobile:section-disclosure:v1:';

export type SectionDisclosureTab = 'overview' | 'planner' | 'foods' | 'history' | 'settings';
export type SectionDisclosureKey = `${SectionDisclosureTab}:${string}`;

export type SectionDisclosureStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function storageKey(section: SectionDisclosureKey) {
  if (!/^(overview|planner|foods|history|settings):[a-z0-9-]+$/.test(section)) {
    throw new Error('Choose a valid tab section.');
  }
  return `${SECTION_DISCLOSURE_STORAGE_PREFIX}${section}`;
}

export function createSectionDisclosurePreferences(storage: SectionDisclosureStorage) {
  const pendingWrites = new Map<string, Promise<void>>();
  return {
    async load(section: SectionDisclosureKey): Promise<boolean> {
      const key = storageKey(section);
      await pendingWrites.get(key)?.catch(() => {});
      const saved = await storage.getItem(key);
      if (saved === null || saved === 'expanded') return true;
      if (saved === 'collapsed') return false;
      throw new Error('The saved section display choice is unsupported.');
    },
    save(section: SectionDisclosureKey, expanded: boolean): Promise<void> {
      const key = storageKey(section);
      if (typeof expanded !== 'boolean') return Promise.reject(new Error('Choose whether this section is expanded.'));
      const previous = pendingWrites.get(key) ?? Promise.resolve();
      const write = previous.catch(() => {}).then(() => storage.setItem(key, expanded ? 'expanded' : 'collapsed'));
      pendingWrites.set(key, write);
      const clear = () => {
        if (pendingWrites.get(key) === write) pendingWrites.delete(key);
      };
      void write.then(clear, clear);
      return write;
    },
  };
}

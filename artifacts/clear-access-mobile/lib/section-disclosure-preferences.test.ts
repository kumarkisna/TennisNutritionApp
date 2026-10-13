// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import {
  createSectionDisclosurePreferences,
  SECTION_DISCLOSURE_STORAGE_PREFIX,
  type SectionDisclosureStorage,
} from './section-disclosure-preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: SectionDisclosureStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  return { storage, values };
}

test('tab sections default open and remember independent choices across reloads', async () => {
  const { storage } = memoryStorage();
  const preferences = createSectionDisclosurePreferences(storage);
  assert.equal(await preferences.load('overview:meal-glance'), true);
  assert.equal(await preferences.load('planner:sleep'), true);
  assert.equal(await preferences.load('foods:library'), true);
  assert.equal(await preferences.load('history:calendar'), true);
  assert.equal(await preferences.load('settings:theme'), true);

  await preferences.save('planner:sleep', false);
  await preferences.save('foods:library', false);
  await preferences.save('settings:theme', false);

  const afterReload = createSectionDisclosurePreferences(storage);
  assert.equal(await afterReload.load('planner:sleep'), false);
  assert.equal(await afterReload.load('foods:library'), false);
  assert.equal(await afterReload.load('settings:theme'), false);
  assert.equal(await afterReload.load('overview:meal-glance'), true);
  assert.equal(await afterReload.load('history:calendar'), true);
});

test('concurrent changes to different sections persist without overwriting each other', async () => {
  const { storage } = memoryStorage();
  const preferences = createSectionDisclosurePreferences(storage);
  await Promise.all([
    preferences.save('overview:meal-glance', false),
    preferences.save('history:calendar', false),
    preferences.save('planner:meals', false),
  ]);
  const reloaded = createSectionDisclosurePreferences(storage);
  assert.equal(await reloaded.load('overview:meal-glance'), false);
  assert.equal(await reloaded.load('history:calendar'), false);
  assert.equal(await reloaded.load('planner:meals'), false);
});

test('rapid changes to one section preserve the last chosen state', async () => {
  const { storage } = memoryStorage();
  const preferences = createSectionDisclosurePreferences(storage);
  await Promise.all([
    preferences.save('foods:library', false),
    preferences.save('foods:library', true),
  ]);
  assert.equal(await createSectionDisclosurePreferences(storage).load('foods:library'), true);
});

test('unsupported stored choices and invalid section keys fail explicitly', async () => {
  const key = `${SECTION_DISCLOSURE_STORAGE_PREFIX}settings:theme`;
  const { storage } = memoryStorage({ [key]: 'hidden' });
  const preferences = createSectionDisclosurePreferences(storage);
  await assert.rejects(preferences.load('settings:theme'), /section display choice/i);
  await assert.rejects(preferences.load('settings:theme//other' as never), /valid tab section/i);
});

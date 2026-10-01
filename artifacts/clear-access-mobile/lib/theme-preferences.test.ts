// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import { themes, DEFAULT_THEME_ID } from '../constants/colors';
import { createThemePreferences, THEME_STORAGE_KEY, type ThemeStorage } from './theme-preferences';

class MemoryStorage implements ThemeStorage {
  values = new Map<string, string>();
  failWrite = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Device storage is unavailable');
    this.values.set(key, value);
  }
}

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(start => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('exactly 76 unique complete themes retain the original 20 and include the requested warm themes', () => {
  assert.equal(themes.length, 76);
  assert.equal(new Set(themes.map(theme => theme.id)).size, 76);
  assert.equal(new Set(themes.map(theme => theme.name)).size, 76);
  assert.deepEqual(themes.slice(0, 20).map(theme => theme.id), [
    'classic', 'forest', 'mint', 'ocean', 'sky', 'lavender', 'rose', 'peach', 'sunflower', 'terracotta',
    'midnight', 'charcoal', 'deep-forest', 'deep-ocean', 'amethyst', 'burgundy', 'espresso', 'graphite',
    'high-contrast-light', 'high-contrast-dark',
  ]);
  assert.ok(themes.some(theme => theme.id === 'high-contrast-light'));
  assert.ok(themes.some(theme => theme.id === 'high-contrast-dark'));
  assert.ok(themes.some(theme => theme.id === 'orange-light' && theme.mode === 'light'));
  assert.ok(themes.some(theme => theme.id === 'orange-dark' && theme.mode === 'dark'));
  assert.ok(themes.some(theme => theme.id === 'saffron' && theme.name === 'Saffron'));
  assert.ok(themes.some(theme => theme.id === 'sunrise' && theme.name === 'Sunrise'));
  assert.ok(themes.some(theme => theme.id === 'saffron-dark' && theme.name === 'Saffron Dark' && theme.mode === 'dark'));
  assert.ok(themes.some(theme => theme.id === 'sunrise-dark' && theme.name === 'Sunrise Dark' && theme.mode === 'dark'));
  const tokens = Object.keys(themes[0].palette).sort();
  for (const theme of themes) {
    assert.deepEqual(Object.keys(theme.palette).sort(), tokens);
    for (const value of Object.values(theme.palette)) assert.match(value, /^#[a-fA-F0-9]{6}$/);
  }
});

test('all themes meet normal-text contrast on their actual semantic surfaces', () => {
  for (const theme of themes) {
    const p = theme.palette;
    const pairs: [string, string][] = [
      [p.foreground, p.background], [p.foreground, p.card], [p.foreground, p.secondary],
      [p.mutedForeground, p.background], [p.mutedForeground, p.card], [p.mutedForeground, p.secondary],
      [p.primary, p.background], [p.primary, p.card], [p.primary, p.secondary], [p.primary, p.accent],
      [p.primaryForeground, p.primary], [p.destructive, p.destructiveSoft],
      [p.inkForeground, p.ink], [p.inkForeground, p.inkSecondary],
      [p.inkSoft, p.ink], [p.inkSoft, p.inkSecondary], [p.mint, p.ink], [p.coral, p.ink],
    ];
    for (const [foreground, background] of pairs) {
      assert.ok(contrast(foreground, background) >= 4.5,
        `${theme.name}: ${foreground} on ${background} contrast ${contrast(foreground, background).toFixed(2)}`);
    }
    assert.ok(contrast(p.chartMeasurement, p.card) >= 3, `${theme.name}: height points`);
  }
});

test('fresh devices use Classic without writing or touching planner storage', async () => {
  const storage = new MemoryStorage();
  storage.values.set('clear-access-mobile:planner:v1', 'planner bytes must stay unchanged');
  assert.equal(await createThemePreferences(storage).load(), DEFAULT_THEME_ID);
  assert.equal(storage.values.size, 1);
});

test('every choice persists and restores independently of planner records', async () => {
  const storage = new MemoryStorage();
  const plannerBytes = '{"saved":"people, meals and foods"}';
  storage.values.set('clear-access-mobile:planner:v1', plannerBytes);
  for (const theme of themes) {
    await createThemePreferences(storage).save(theme.id);
    assert.equal(await createThemePreferences(storage).load(), theme.id);
    assert.equal(storage.values.get('clear-access-mobile:planner:v1'), plannerBytes);
  }
});

test('corrupted or unsupported preferences fail explicitly and preserve bytes', async () => {
  const storage = new MemoryStorage();
  for (const serialized of ['broken JSON', 'null', '{"version":2,"themeId":"classic"}', '{"version":1,"themeId":"unknown"}']) {
    storage.values.set(THEME_STORAGE_KEY, serialized);
    await assert.rejects(createThemePreferences(storage).load(), /saved appearance setting/i);
    assert.equal(storage.values.get(THEME_STORAGE_KEY), serialized);
  }
  await assert.rejects(createThemePreferences(storage).save('unknown'), /supported theme/);
});

test('failed saves preserve the last durable theme', async () => {
  const storage = new MemoryStorage();
  const preferences = createThemePreferences(storage);
  await preferences.save('midnight');
  storage.failWrite = true;
  await assert.rejects(preferences.save('forest'), /storage is unavailable/);
  assert.equal(await createThemePreferences(storage).load(), 'midnight');
});
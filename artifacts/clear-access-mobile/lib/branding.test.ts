// @ts-ignore Node test modules are used only in the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules are used only in the direct regression runner.
import { readFileSync } from 'node:fs';
// @ts-ignore Node test modules are used only in the direct regression runner.
import path from 'node:path';
// @ts-ignore Node test modules are used only in the direct regression runner.
import test from 'node:test';
import appConfig from '../app.json';
import { APP_NAME, COPYRIGHT_NOTICE } from '../constants/branding';

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]!);
}

test('Overview branding and generated splash artwork use app.json values', () => {
  const config = appConfig.expo;
  assert.equal(APP_NAME, config.name);
  assert.equal(COPYRIGHT_NOTICE, config.extra?.copyrightNotice);

  const separator = ' — ';
  const separatorIndex = config.name.indexOf(separator);
  const title = separatorIndex >= 0 ? config.name.slice(0, separatorIndex) : config.name;
  const subtitle = separatorIndex >= 0 ? config.name.slice(separatorIndex + separator.length) : '';
  const imageDirectory = path.resolve(process.cwd(), 'assets', 'images');

  for (const variant of ['light', 'dark']) {
    const artwork = readFileSync(path.join(imageDirectory, `splash-${variant}.svg`), 'utf8');
    assert.ok(artwork.includes(escapeXml(title)), `${variant} splash is missing the app title`);
    if (subtitle) assert.ok(artwork.includes(escapeXml(subtitle)), `${variant} splash is missing the app subtitle`);
    assert.ok(artwork.includes(escapeXml(COPYRIGHT_NOTICE)), `${variant} splash is missing the copyright notice`);
  }
});

// @ts-ignore Node test modules belong to the direct regression runner.
import assert from 'node:assert/strict';
// @ts-ignore Node test modules belong to the direct regression runner.
import test from 'node:test';
import { buildAboutInstructionsHtml } from './print-about';

test('About printout includes every guide chapter, step, and navigation link', () => {
  const html = buildAboutInstructionsHtml({
    appName: 'Clear Access',
    copyrightNotice: 'Copyright Trust',
    guides: [
      { id: 'planner', title: 'Plan a day', summary: 'Meals and sleep.', steps: [{ title: 'Choose a date', body: 'Pick the date to plan.' }] },
      { id: 'foods', title: 'Manage foods', summary: 'Find or add foods.', steps: [{ title: 'Scan a barcode', body: 'Enter missing nutrition manually.' }] },
    ],
  });

  assert.match(html, /Copyright Trust/);
  assert.match(html, /href="#planner"/);
  assert.match(html, /href="#foods"/);
  assert.match(html, /Plan a day/);
  assert.match(html, /Choose a date/);
  assert.match(html, /Scan a barcode/);
});

test('About printout escapes app-supplied text before embedding it as HTML', () => {
  const html = buildAboutInstructionsHtml({
    appName: 'Food <Planner>',
    copyrightNotice: 'Trust & Co.',
    guides: [{ id: 'intro', title: 'A "guide"', summary: 'Read <this>.', steps: [{ title: "It's safe", body: 'A & B' }] }],
  });

  assert.match(html, /Food &lt;Planner&gt;/);
  assert.match(html, /Trust &amp; Co\./);
  assert.match(html, /A &quot;guide&quot;/);
  assert.match(html, /It&#39;s safe/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /<this>/);
});

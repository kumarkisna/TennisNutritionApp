import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoalHistoryEntries } from '../src/GoalHistory';

test('goal history visibly distinguishes unset values and user-provided sources', () => {
  const html = renderToStaticMarkup(<GoalHistoryEntries entries={[{
    id: 1, personId: 2, nutrient: 'iron', previousAmount: 18, amount: null,
    previousSource: 'Advice <not verified>', source: null, changedAt: '2026-10-12T08:00:00Z',
  }]} />);
  assert.match(html, /Goal cleared/);
  assert.match(html, /18 mg\/day/);
  assert.match(html, /Unset/);
  assert.match(html, /User-provided source/);
  assert.match(html, /Advice &lt;not verified&gt;/);
  assert.match(html, /No source note/);
  assert.match(renderToStaticMarkup(<GoalHistoryEntries entries={[]} />), /No recorded goal changes/);
});

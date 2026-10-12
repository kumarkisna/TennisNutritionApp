import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Food } from '@workspace/api-client-react';
import { FoodsCatalogTable } from '../src/FoodsCatalogTable';
import { MineralCorrectionDialog } from '../src/MineralCorrectionDialog';

const food: Food = {
  id: 1, name: 'Pack food', category: 'other', source: 'open_food_facts',
  sourceUrl: 'https://world.openfoodfacts.org/product/12345678',
  caloriesPer100g: 200, proteinPer100g: 5, carbsPer100g: 30, fatPer100g: 7, fiberPer100g: 2, fiberKnown: true,
  calciumMgPer100g: null, ironMgPer100g: 0, supplierCalciumMgPer100g: 120, supplierIronMgPer100g: 4.2,
  calciumCorrectionEnabled: true, ironCorrectionEnabled: true, mineralCorrectionNote: 'Pack label',
};

test('imported corrections are discoverable and retain source attribution', () => {
  const html = renderToStaticMarkup(<FoodsCatalogTable foods={[food, { ...food, id: 2, source: 'reference' }, { ...food, id: 3, source: 'custom' }]}
    onEdit={() => {}} onDelete={() => {}} onCorrect={() => {}} deleting={false} />);
  assert.match(html, /button-correct-minerals-1/);
  assert.doesNotMatch(html, /button-correct-minerals-[23]/);
  assert.match(html, /Imported · Open Food Facts/);
  assert.match(html, /Minerals adjusted by you/);
  assert.match(html, /not verified/);
  assert.match(html, /button-edit-food-3/);
});

test('dialog shows supplier values separately, unknown correction, units, and impact warning', () => {
  const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>
    <MineralCorrectionDialog food={food} close={() => {}} onSaved={() => {}} />
  </QueryClientProvider>);
  assert.match(html, /saved supplier value/);
  assert.match(html, /120 mg \/ 100 g/);
  assert.match(html, /4.2 mg \/ 100 g/);
  assert.match(html, /Blank means unknown/);
  assert.match(html, /including earlier dates/);
  assert.match(html, /Use saved supplier value/);
  assert.match(html, /input-correction-iron/);
  assert.match(html, /Pack label/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getGetDayActivityQueryKey, type Nutrition, type Person } from "@workspace/api-client-react";
import { SportsReferencePanel } from "../src/SportsReferencePanel";

const person: Person = {
  id: 101, name: "Test person", isDefault: false,
  weightKg: 70, ageYears: 25, ironGoalMg: 18, fatGoalG: 70,
  activityLevel: "sedentary", baselineCalories: 2000, activityMultiplier: 1, targetCalories: 2000,
};

function comparison(ironMg: number | null, currentPerson = person) {
  const client = new QueryClient();
  const date = "2026-09-29";
  client.setQueryData(getGetDayActivityQueryKey({ date, personId: currentPerson.id }), {
    date, personId: currentPerson.id, activityType: "rest",
  });
  const totals: Nutrition = {
    calories: 120, protein: 4, carbs: 20, fat: 3, fiber: 2, calciumMg: 40, ironMg,
  };
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client },
      createElement(SportsReferencePanel, {
        person: currentPerson, date, totals, summaryLoading: false, summaryError: false,
      })),
  );
}

test("daily comparison keeps an iron goal visible but flags incomplete intake", () => {
  const markup = comparison(null);
  const ironRow = markup.split('data-testid="comparison-iron"')[1]?.split('data-testid="comparison-fiber"')[0];
  assert.ok(ironRow, "iron comparison row must be present");
  assert.match(ironRow, /18 mg \/ day \(your goal\)/);
  assert.match(ironRow, /Not fully reported/);
  assert.doesNotMatch(ironRow, /0 mg/);
  assert.match(comparison(4.2), /4\.2 mg/);
});

test("cleared goals are not shown as calculated targets", () => {
  const markup = comparison(null, { ...person, ironGoalMg: null, fatGoalG: null });
  assert.match(markup, /No personal goal set/);
  assert.match(markup, /Not fully reported/);
});
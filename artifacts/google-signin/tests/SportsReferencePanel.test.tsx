import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { DayActivityType, getGetDayActivityQueryKey, type Nutrition, type Person } from "@workspace/api-client-react";
import { SportsReferencePanel } from "../src/SportsReferencePanel";

const person: Person = {
  id: 101, name: "Test person", isDefault: false,
  weightKg: 70, ageYears: 25, ironGoalMg: 18, fatGoalG: 70,
  activityLevel: "sedentary", baselineCalories: 2000, activityMultiplier: 1, targetCalories: 2000,
};

function comparison(ironMg: number | null, currentPerson = person, activityType: DayActivityType = "rest") {
  const client = new QueryClient();
  const date = "2026-09-29";
  client.setQueryData(getGetDayActivityQueryKey({ date, personId: currentPerson.id }), {
    date, personId: currentPerson.id, activityType,
  });
  const totals: Nutrition = {
    calories: 120, protein: 4, carbs: 20, fat: 3, fiber: 2, calciumMg: 40, ironMg,
  };
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client },
      createElement(Router, { hook: () => ["/", () => {}] as const },
        createElement(SportsReferencePanel, {
          person: currentPerson, date, totals, summaryLoading: false, summaryError: false,
        }))),
  );
}

function reference(markup: string, label: string) {
  const row = markup.match(new RegExp(`data-testid="comparison-${label}"[\\s\\S]*?(?=data-testid="comparison-|<p class="mt-4)`))?.[0];
  assert.ok(row, `${label} row must be present`);
  return row.match(/<strong>([^<]*)<\/strong>/)?.[1];
}

test("every planned activity shows the workbook's weight-based daily ranges", () => {
  // Fixed expected results for a 70 kg person; these are intentionally independent
  // of the panel's activity table so a changed reference value fails this check.
  const cases: [DayActivityType, string, string][] = [
    ["rest", "Not specified in workbook", "56–70 g / day"],
    ["low_intensity", "Not specified in workbook", "56–70 g / day"],
    ["training_60", "350–420 g / day", "56–70 g / day"],
    ["training_120", "490–560 g / day", "56–70 g / day"],
    ["endurance", "560–700 g / day", "84–98 g / day"],
    ["extreme", "700 g / day", "84–98 g / day"],
    ["strength", "Not specified in workbook", "112–119 g / day"],
  ];
  assert.deepEqual(cases.map(([activity]) => activity).sort(), Object.values(DayActivityType).sort(),
    "every supported activity needs a workbook-reference assertion");
  for (const [activity, carbs, protein] of cases) {
    const markup = comparison(null, person, activity);
    assert.equal(reference(markup, "carbohydrates"), carbs, `${activity} carbohydrates`);
    assert.equal(reference(markup, "protein"), protein, `${activity} protein`);
    assert.match(markup, new RegExp(`value="${activity}"[^>]*selected`), `${activity} selected`);
  }
});

test("ranges use the person's weight, while unspecified carbohydrates stay unavailable", () => {
  const lighter = { ...person, weightKg: 62.5 };
  const markup = comparison(null, lighter, "training_60");
  assert.equal(reference(markup, "carbohydrates"), "313–375 g / day");
  assert.equal(reference(markup, "protein"), "50–63 g / day");

  const missingWeight = { ...person, weightKg: null };
  assert.equal(reference(comparison(null, missingWeight, "strength"), "carbohydrates"), "Not specified in workbook");
  assert.equal(reference(comparison(null, missingWeight, "training_60"), "carbohydrates"), "Add body weight to calculate");
  assert.equal(reference(comparison(null, missingWeight, "training_60"), "protein"), "Add body weight to calculate");
});

test("calcium uses the supported age boundaries without inventing other targets", () => {
  for (const [ageYears, expected] of [
    [null, "Add age (workbook covers 12+ only)"],
    [11, "Not specified in workbook for under 12"],
    [12, "1,000–1,200 mg / day"],
    [18, "1,000–1,200 mg / day"],
    [19, "800–1,000 mg / day"],
  ] as const) {
    const markup = comparison(null, { ...person, ageYears }, "endurance");
    assert.equal(reference(markup, "calcium"), expected, `age ${ageYears}`);
    assert.equal(reference(markup, "fiber"), "No quantitative range in workbook");
  }
  const withoutGoals = comparison(null, { ...person, ironGoalMg: null, fatGoalG: null });
  assert.equal(reference(withoutGoals, "iron"), "No personal goal set");
  assert.equal(reference(withoutGoals, "fat"), "No personal goal set");
});

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
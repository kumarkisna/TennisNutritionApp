// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { estimateSessionSweatRate, hydrationReference, hydrationTotals, mergeHydrationSchedule, summarizeHydrationRecords } from './hydration';
import { buildReminders } from './meal-reminders';

test('hydration daily references distinguish total water from beverage intake', () => {
  assert.deepEqual(hydrationReference('2013-05-01', 'female', '2026-05-01'), {
    age: 13, totalLiters: [2.1, 2.1], beverageLiters: [1.6, 1.6],
  });
  assert.deepEqual(hydrationReference('2010-01-01', null, '2026-01-01'), {
    age: 16, totalLiters: [2.3, 3.3], beverageLiters: [1.8, 2.6],
  });
});

test('session sweat-rate estimate includes fluid consumed and urine output', () => {
  assert.equal(estimateSessionSweatRate({
    durationMinutes: 60, preWeightKg: 70, postWeightKg: 69.5, fluidMl: 750, urineMl: 250,
  }), 1);
  assert.equal(estimateSessionSweatRate({
    durationMinutes: 0, preWeightKg: 70, postWeightKg: 69, fluidMl: 0, urineMl: 0,
  }), null);
});

test('schedule reuse copies only planned amounts and preserves destination actual logs', () => {
  const current = [{ id: 'dest', time: '09:00', plannedMl: 200, actualMl: 150, alertEnabled: false }];
  const source = [
    { id: 'source-1', time: '09:00', plannedMl: 300, actualMl: 290, alertEnabled: true },
    { id: 'source-2', time: '11:00', plannedMl: 250, actualMl: 250, alertEnabled: false },
  ];
  const merged = mergeHydrationSchedule(current, source, index => `new-${index}`);
  assert.deepEqual(merged, [
    { id: 'dest', time: '09:00', plannedMl: 300, actualMl: 150, alertEnabled: true },
    { id: 'new-1', time: '11:00', plannedMl: 250, actualMl: null, alertEnabled: false },
  ]);
  assert.deepEqual(hydrationTotals({ entries: merged, sessions: [] }), { plannedMl: 550, actualMl: 150 });
});

test('weekly hydration summaries separate missing actuals from recorded zero amounts', () => {
  const stats = summarizeHydrationRecords([
    { date: '2026-10-05', hydration: { entries: [
      { id: 'one', time: '09:00', plannedMl: 250, actualMl: 200, alertEnabled: false },
      { id: 'two', time: '12:00', plannedMl: 300, actualMl: null, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-06', hydration: { entries: [
      { id: 'three', time: '15:00', plannedMl: 400, actualMl: 0, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-07', hydration: undefined },
  ], '2026-10-07');
  assert.deepEqual(stats, {
    elapsedDays: 3,
    plannedDays: 2,
    noEntryDays: 1,
    actualDays: 2,
    plannedEntryCount: 3,
    recordedEntryCount: 2,
    plannedMl: 950,
    plannedForRecordedMl: 650,
    actualMl: 200,
  });
});

test('hydration alerts use their planned date/time and stop once actual intake is logged', () => {
  const source = {
    enabled: true,
    people: [{ id: 7, name: 'Player' }],
    days: [{
      date: '2026-10-11', personId: 7,
      hydration: { entries: [
        { id: 'hydration-one', time: '09:15', plannedMl: 250, actualMl: null, alertEnabled: true },
        { id: 'hydration-two', time: '10:00', plannedMl: 300, actualMl: 300, alertEnabled: true },
      ], sessions: [] },
    }],
  };
  const result = buildReminders(source, new Date(2026, 9, 11, 8).getTime());
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].at, new Date(2026, 9, 11, 9, 15).getTime());
  assert.match(result.jobs[0].body, /250 mL/);
});

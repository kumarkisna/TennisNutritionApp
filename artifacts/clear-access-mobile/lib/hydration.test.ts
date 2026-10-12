// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { compareHydrationSummaries, estimateSessionSweatRate, hydrationReference, hydrationTotals, mergeHydrationSchedule, summarizeHydrationByActivity, summarizeHydrationByWeekday, summarizeHydrationRecords } from './hydration';
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

test('monthly hydration comparison normalizes planned and recorded totals by observed days', () => {
  const current = summarizeHydrationRecords([{
    date: '2026-10-01',
    hydration: { entries: [
      { id: 'a', time: '09:00', plannedMl: 500, actualMl: 500, alertEnabled: false },
      { id: 'b', time: '12:00', plannedMl: 300, actualMl: null, alertEnabled: false },
    ], sessions: [] },
  }], '2026-10-01');
  const comparison = summarizeHydrationRecords([{
    date: '2026-09-01',
    hydration: { entries: [
      { id: 'c', time: '09:00', plannedMl: 400, actualMl: 200, alertEnabled: false },
    ], sessions: [] },
  }], '2026-09-01');
  assert.deepEqual(compareHydrationSummaries(current, comparison), {
    plannedPerPlannedDayChangeMl: 400,
    recordedPerRecordedDayChangeMl: 300,
    currentRecordedVsPlannedPercent: 100,
    comparisonRecordedVsPlannedPercent: 50,
  });
});

test('hydration comparison reports unavailable when a month has no planned or recorded days', () => {
  const empty = summarizeHydrationRecords([{ date: '2026-10-01', hydration: undefined }], '2026-10-01');
  assert.deepEqual(compareHydrationSummaries(empty, empty), {
    plannedPerPlannedDayChangeMl: null,
    recordedPerRecordedDayChangeMl: null,
    currentRecordedVsPlannedPercent: null,
    comparisonRecordedVsPlannedPercent: null,
  });
});

test('weekday hydration summaries compare planned and actual intake without treating missing entries as zero', () => {
  const summary = summarizeHydrationByWeekday([
    { date: '2026-10-05', hydration: { entries: [
      { id: 'a', time: '09:00', plannedMl: 500, actualMl: 400, alertEnabled: false },
      { id: 'b', time: '12:00', plannedMl: 300, actualMl: null, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-12', hydration: { entries: [
      { id: 'c', time: '09:00', plannedMl: 600, actualMl: 300, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-19', hydration: { entries: [
      { id: 'd', time: '09:00', plannedMl: 250, actualMl: null, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-06', hydration: { entries: [
      { id: 'e', time: '09:00', plannedMl: 700, actualMl: 700, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-20', hydration: { entries: [
      { id: 'future', time: '09:00', plannedMl: 900, actualMl: 900, alertEnabled: false },
    ], sessions: [] } },
  ], '2026-10-19');
  assert.equal(summary.length, 7);
  assert.deepEqual(summary[1], {
    weekday: 1,
    elapsedDays: 3,
    plannedDays: 3,
    noEntryDays: 0,
    actualDays: 2,
    plannedEntryCount: 4,
    recordedEntryCount: 2,
    plannedMl: 1650,
    plannedForRecordedMl: 1100,
    actualMl: 700,
  });
  assert.equal(summary[2].actualMl, 700);
  assert.equal(summary[2].plannedMl, 700);
});

test('activity hydration summaries separate saved active and rest days and keep paired amounts complete', () => {
  const summary = summarizeHydrationByActivity([
    { date: '2026-10-01', activityType: 'training_60', tennis: {
      mode: 'training', sessions: [{ kind: 'practice', startTime: '09:00', durationMinutes: 60, intensity: 'moderate' }],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    }, hydration: { entries: [
      { id: 'active-recorded', time: '09:00', plannedMl: 500, actualMl: 300, alertEnabled: false },
      { id: 'active-missing', time: '12:00', plannedMl: 250, actualMl: null, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-02', activityType: 'rest', hydration: { entries: [
      { id: 'rest-zero', time: '10:00', plannedMl: 400, actualMl: 0, alertEnabled: false },
    ], sessions: [] } },
    { date: '2026-10-03', activityType: 'strength', hydration: undefined },
    { date: '2026-10-04', activityType: 'rest', hydration: undefined },
    { date: '2026-10-05', activityType: 'training_120', tennis: {
      mode: 'tournament', sessions: [{ kind: 'match', startTime: '09:00', durationMinutes: 60, intensity: 'hard' }],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    }, hydration: { entries: [
      { id: 'future', time: '09:00', plannedMl: 900, actualMl: 900, alertEnabled: false },
    ], sessions: [] } },
  ], '2026-10-04');

  assert.deepEqual(summary.map(({ group, elapsedDays, plannedDays, actualDays, plannedMl, plannedForRecordedMl, actualMl }) => ({
    group, elapsedDays, plannedDays, actualDays, plannedMl, plannedForRecordedMl, actualMl,
  })), [
    { group: 'active', elapsedDays: 1, plannedDays: 1, actualDays: 1, plannedMl: 750, plannedForRecordedMl: 500, actualMl: 300 },
    { group: 'rest', elapsedDays: 2, plannedDays: 1, actualDays: 1, plannedMl: 400, plannedForRecordedMl: 400, actualMl: 0 },
  ]);
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

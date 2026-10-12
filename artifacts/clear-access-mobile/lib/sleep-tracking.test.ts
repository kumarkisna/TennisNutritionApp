// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { calculateTotalSleepMinutes, formatSleepDuration, reusableSleepTimes, shiftSleepMonth, sleepDurationMinutes, sleepMonthDates, sleepMonthWeekRanges, sleepMonthsBetween, sleepReferenceForDate, summarizeSleepQualityByMonth, sleepWeekDates, summarizeSleepQualityByWeekday, summarizeSleepRecords } from './sleep-tracking';

test('sleep duration handles overnight sleep and daytime sleep', () => {
  assert.equal(sleepDurationMinutes('22:30', '06:45'), 495);
  assert.equal(sleepDurationMinutes('09:00', '15:00'), 360);
  assert.equal(formatSleepDuration(495), '8 hr 15 min');
  assert.equal(formatSleepDuration(480), '8 hr');
  assert.equal(formatSleepDuration(30), '30 min');
});

test('sleep duration rejects invalid and identical times', () => {
  assert.equal(sleepDurationMinutes('24:00', '07:00'), null);
  assert.equal(sleepDurationMinutes('22:00', '22:00'), null);
});

test('reusable previous-day values include only valid bedtime and wake time', () => {
  const previousSleep = {
    bedtime: '22:30', wakeTime: '06:45', quality: 2, note: 'Do not copy this',
    naps: [{ startTime: '13:00', endTime: '14:00' }],
    wakeUps: [{ startTime: '02:00', endTime: '02:15' }],
  };
  assert.deepEqual(reusableSleepTimes(previousSleep), { bedtime: '22:30', wakeTime: '06:45' });
  assert.equal(reusableSleepTimes(undefined), null);
  assert.equal(reusableSleepTimes({ bedtime: null, wakeTime: null }), null);
  assert.equal(reusableSleepTimes({ bedtime: '22:30', wakeTime: null }), null);
  assert.equal(reusableSleepTimes({ bedtime: '25:30', wakeTime: '06:45' }), null);
});

test('sleep quality ranges include every selected month and reject reversed or excessive ranges', () => {
  assert.deepEqual(sleepMonthsBetween('2025-12', '2026-02'), ['2025-12', '2026-01', '2026-02']);
  assert.deepEqual(sleepMonthsBetween('2026-02', '2026-01'), []);
  assert.deepEqual(sleepMonthsBetween('2026-13', '2027-01'), []);
  assert.deepEqual(sleepMonthsBetween('2015-01', '2026-01'), []);
});

test('monthly quality averages and counts ignore missing dates, unrated logs, and future ratings', () => {
  const results = summarizeSleepQualityByMonth([
    { date: '2026-01-02', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-03', sleep: { bedtime: null, wakeTime: null, quality: 0, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-04', sleep: { bedtime: null, wakeTime: null, quality: 1, note: '', naps: [], wakeUps: [] } },
    { date: '2026-02-01', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] } },
    { date: '2026-02-02', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 2, note: '', naps: [], wakeUps: [] } },
    { date: '2026-03-02', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] } },
  ], '2026-01', '2026-03', '2026-02-28');
  assert.deepEqual(results, [
    { month: '2026-01', averageQuality: 3, ratedDays: 2, qualityCounts: [1, 0, 0, 0, 1] },
    { month: '2026-02', averageQuality: 3, ratedDays: 2, qualityCounts: [0, 1, 0, 1, 0] },
    { month: '2026-03', averageQuality: null, ratedDays: 0, qualityCounts: [0, 0, 0, 0, 0] },
  ]);
});

test('month weeks use Monday boundaries and mark partial calendar weeks', () => {
  const ranges = sleepMonthWeekRanges('2026-10');
  assert.equal(ranges.length, 5);
  assert.deepEqual([ranges[0].startDate, ranges[0].endDate, ranges[0].partial], ['2026-10-01', '2026-10-04', true]);
  assert.deepEqual([ranges[1].startDate, ranges[1].endDate, ranges[1].partial], ['2026-10-05', '2026-10-11', false]);
  assert.deepEqual([ranges[4].startDate, ranges[4].endDate, ranges[4].partial], ['2026-10-26', '2026-10-31', true]);
});

test('sleep summaries separate missing dates from nap-only, overnight, and zero-minute records', () => {
  const records = [
    { date: '2026-10-01', sleep: undefined, minutes: null },
    { date: '2026-10-02', sleep: { bedtime: null, wakeTime: null, quality: 5, note: '', naps: [{ startTime: '13:00', endTime: '14:30' }], wakeUps: [] }, minutes: 90 },
    { date: '2026-10-03', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-04', sleep: { bedtime: '22:00', wakeTime: '22:00', quality: 2, note: '', naps: [], wakeUps: [] }, minutes: 0 },
    { date: '2026-10-05', sleep: { bedtime: null, wakeTime: null, quality: 1, note: '', naps: [], wakeUps: [] }, minutes: null },
    { date: '2026-10-06', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] }, minutes: 480 },
  ];
  assert.deepEqual(summarizeSleepRecords(records, '2026-10-05'), {
    elapsedDays: 5,
    loggedDays: 4,
    missingDays: 1,
    napOnlyDays: 1,
    overnightDays: 2,
    averageMinutes: 190,
    ratedDays: 4,
    qualityCounts: [1, 1, 0, 1, 1],
    averageQuality: 3,
  });
});

test('sleep quality distribution includes only valid 1–5 ratings from logged dates', () => {
  const records = [
    { date: '2026-10-01', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 1, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-02', sleep: { bedtime: null, wakeTime: null, quality: 2, note: '', naps: [{ startTime: '13:00', endTime: '14:00' }], wakeUps: [] }, minutes: 60 },
    { date: '2026-10-03', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 2, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-04', sleep: { bedtime: null, wakeTime: null, quality: 5, note: '', naps: [], wakeUps: [] }, minutes: null },
    { date: '2026-10-05', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 0, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-06', sleep: undefined, minutes: null },
  ];
  const summary = summarizeSleepRecords(records, '2026-10-06');
  assert.equal(summary.loggedDays, 5);
  assert.equal(summary.missingDays, 1);
  assert.equal(summary.ratedDays, 4);
  assert.deepEqual(summary.qualityCounts, [1, 2, 0, 0, 1]);
  assert.equal(summary.averageQuality, 2.5);
});

test('weekday sleep ratings group valid scores, ignore missing and unrated dates, and stop at the selected date', () => {
  const summary = summarizeSleepQualityByWeekday([
    { date: '2026-10-05', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-06', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 2, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-06', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-07', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 0, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-08', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 3, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-09', sleep: undefined, minutes: null },
    { date: '2026-10-10', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 1, note: '', naps: [], wakeUps: [] }, minutes: 480 },
  ], '2026-10-08');
  assert.equal(summary.length, 7);
  assert.deepEqual(summary.map(day => day.ratingCount), [0, 1, 2, 0, 1, 0, 0]);
  assert.equal(summary[1].averageQuality, 5);
  assert.equal(summary[2].averageQuality, 3);
  assert.deepEqual(summary[2].qualityCounts, [0, 1, 0, 1, 0]);
  assert.equal(summary[6].averageQuality, null);
});

test('sleep reference ranges are calculated from age on each selected date', () => {
  assert.equal(sleepReferenceForDate('2014-10-10', '2026-10-09')?.label, '9–12 h');
  assert.equal(sleepReferenceForDate('2014-10-10', '2026-10-10')?.label, '9–12 h');
  assert.equal(sleepReferenceForDate('2025-11-01', '2026-10-10')?.includesNaps, true);
  assert.equal(sleepReferenceForDate(null, '2026-10-10'), null);
});

test('total sleep subtracts overnight wake-ups and includes naps', () => {
  assert.equal(calculateTotalSleepMinutes({
    bedtime: '22:00', wakeTime: '06:00',
    wakeUps: [{ startTime: '02:00', endTime: '02:30' }],
    naps: [{ startTime: '13:00', endTime: '14:00' }],
  }), 510);
  assert.equal(calculateTotalSleepMinutes({
    bedtime: '22:00', wakeTime: '06:00',
    naps: [{ startTime: '13:00', endTime: '14:00' }, { startTime: '13:30', endTime: '14:30' }],
  }), 570);
});

test('nap-only logs calculate from naps and merge overlapping nap intervals', () => {
  assert.equal(calculateTotalSleepMinutes({
    bedtime: null, wakeTime: null, wakeUps: [],
    naps: [{ startTime: '13:00', endTime: '14:00' }, { startTime: '13:30', endTime: '14:30' }],
  }), 90);
  assert.equal(calculateTotalSleepMinutes({
    bedtime: null, wakeTime: null, naps: [{ startTime: '09:00', endTime: '10:15' }],
  }), 75);
  assert.equal(calculateTotalSleepMinutes({
    bedtime: null, wakeTime: null, wakeUps: [{ startTime: '02:00', endTime: '02:10' }],
    naps: [{ startTime: '13:00', endTime: '14:00' }],
  }), null);
});

test('overlapping wake-ups are subtracted once and invalid wake intervals fail', () => {
  assert.equal(calculateTotalSleepMinutes({
    bedtime: '22:00', wakeTime: '06:00',
    wakeUps: [{ startTime: '02:00', endTime: '02:30' }, { startTime: '02:15', endTime: '02:45' }],
  }), 435);
  assert.equal(calculateTotalSleepMinutes({
    bedtime: '22:00', wakeTime: '06:00',
    wakeUps: [{ startTime: '05:30', endTime: '06:30' }],
  }), null);
});

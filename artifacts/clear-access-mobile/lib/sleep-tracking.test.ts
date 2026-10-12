// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { calculateTotalSleepMinutes, formatSleepDuration, isValidSleepQuality, reusableSleepTimes, shiftSleepMonth, sleepDurationMinutes, sleepMonthDates, sleepMonthWeekRanges, sleepMonthsBetween, sleepQualityRecordsByActivity, sleepQualityRecordsForMonth, sleepReferenceForDate, summarizeSleepQualityByActivity, summarizeSleepQualityByActivityByMonth, summarizeSleepQualityByMonth, sleepWeekDates, summarizeSleepDurationByWeekday, summarizeSleepQualityByWeekday, summarizeSleepRecords } from './sleep-tracking';
import type { SleepActivityQualityRecord } from './sleep-tracking';

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

test('sleep rating comparisons separate practice, match, and rest and exclude other, missing, invalid, and future ratings', () => {
  const records: SleepActivityQualityRecord[] = [
    { date: '2026-01-02', activityType: 'training_60', tennis: {
      mode: 'training', sessions: [{ kind: 'practice', startTime: '09:00', durationMinutes: 60, intensity: 'moderate' }],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    }, sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-10', activityType: 'training_120', tennis: {
      mode: 'tournament', sessions: [{ kind: 'match', startTime: '10:00', durationMinutes: 90, intensity: 'hard' }],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    }, sleep: { bedtime: '22:30', wakeTime: '06:30', quality: 3, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-11', activityType: 'rest', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 2, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-12', activityType: 'rest', sleep: { bedtime: null, wakeTime: null, quality: 0, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-13', activityType: 'training_60', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-15', activityType: 'training_60', tennis: {
      mode: 'training', sessions: [{ kind: 'gym', startTime: '09:00', durationMinutes: 60, intensity: 'moderate' }],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    }, sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] } },
    { date: '2026-01-14', activityType: 'rest' },
    { date: '2026-02-01', activityType: 'rest', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 6, note: '', naps: [], wakeUps: [] } },
    { date: '2026-02-02', activityType: 'rest', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] } },
    { date: '2026-03-01', activityType: 'rest', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 1, note: '', naps: [], wakeUps: [] } },
  ];

  const byMonth = summarizeSleepQualityByActivityByMonth(records, ['2026-01', '2026-02'], '2026-02-28');
  assert.deepEqual(byMonth.map(({ month, summaries }) => ({
    month,
    summaries: summaries.map(({ group, ratedDays, averageQuality, qualityCounts }) => ({
      group, ratedDays, averageQuality, qualityCounts,
    })),
  })), [
    {
      month: '2026-01',
      summaries: [
        { group: 'practice', ratedDays: 1, averageQuality: 5, qualityCounts: [0, 0, 0, 0, 1] },
        { group: 'match', ratedDays: 1, averageQuality: 3, qualityCounts: [0, 0, 1, 0, 0] },
        { group: 'rest', ratedDays: 1, averageQuality: 2, qualityCounts: [0, 1, 0, 0, 0] },
      ],
    },
    {
      month: '2026-02',
      summaries: [
        { group: 'practice', ratedDays: 0, averageQuality: null, qualityCounts: [0, 0, 0, 0, 0] },
        { group: 'match', ratedDays: 0, averageQuality: null, qualityCounts: [0, 0, 0, 0, 0] },
        { group: 'rest', ratedDays: 1, averageQuality: 4, qualityCounts: [0, 0, 0, 1, 0] },
      ],
    },
  ]);
  assert.deepEqual(summarizeSleepQualityByActivity(records, '2026-02-28').map(item => item.ratedDays), [1, 1, 2]);
});

test('a date with practice and match sessions contributes to both activity groups, not rest', () => {
  const summary = summarizeSleepQualityByActivity([{
    date: '2026-01-02',
    activityType: 'training_60',
    tennis: {
      mode: 'training',
      sessions: [
        { kind: 'practice', startTime: '09:00', durationMinutes: 60, intensity: 'moderate' },
        { kind: 'match', startTime: '11:00', durationMinutes: 90, intensity: 'hard' },
      ],
      fuel: { before: '', during: '', between: '', after: '', hydration: '' },
    },
    sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: '', naps: [], wakeUps: [] },
  }], '2026-01-31');
  assert.deepEqual(summary.map(({ group, ratedDays }) => ({ group, ratedDays })), [
    { group: 'practice', ratedDays: 1 },
    { group: 'match', ratedDays: 1 },
    { group: 'rest', ratedDays: 0 },
  ]);
});

test('activity date details match whole-range and month summaries, excluding future and invalid ratings', () => {
  const makeSleep = (quality: number) => ({
    bedtime: '22:00', wakeTime: '06:00', quality, note: '', naps: [], wakeUps: [],
  });
  const makeTennis = (kinds: ('practice' | 'match' | 'gym')[], mode: 'training' | 'tournament' | 'rest' = 'training') => ({
    mode,
    sessions: kinds.map((kind, index) => ({
      kind, startTime: index ? '11:00' : '09:00', durationMinutes: 60, intensity: 'moderate' as const,
    })),
    fuel: { before: '', during: '', between: '', after: '', hydration: '' },
  });
  const records: SleepActivityQualityRecord[] = [
    { date: '2026-03-31', activityType: 'training_60', tennis: makeTennis(['match']), sleep: makeSleep(4) },
    { date: '2026-04-01', activityType: 'training_60', tennis: makeTennis(['practice']), sleep: makeSleep(3) },
    { date: '2026-04-02', activityType: 'training_60', tennis: makeTennis(['match']), sleep: makeSleep(4) },
    { date: '2026-04-03', activityType: 'training_60', tennis: makeTennis(['practice', 'match']), sleep: makeSleep(5) },
    { date: '2026-04-04', activityType: 'rest', sleep: makeSleep(2) },
    { date: '2026-04-05', activityType: 'training_60', tennis: makeTennis([], 'rest'), sleep: makeSleep(1) },
    { date: '2026-04-06', activityType: 'training_60', tennis: makeTennis(['gym']), sleep: makeSleep(4) },
    { date: '2026-04-07', activityType: 'training_60', tennis: makeTennis(['practice']), sleep: makeSleep(0) },
    { date: '2026-04-08', activityType: 'training_60', tennis: makeTennis(['match']), sleep: makeSleep(6) },
    { date: '2026-04-10', activityType: 'training_60', tennis: makeTennis(['practice']), sleep: makeSleep(5) },
  ];
  const throughDate = '2026-04-09';
  const wholeRange = summarizeSleepQualityByActivity(records, throughDate);
  const expected = {
    practice: ['2026-04-01', '2026-04-03'],
    match: ['2026-03-31', '2026-04-02', '2026-04-03'],
    rest: ['2026-04-04', '2026-04-05'],
  } as const;
  for (const summary of wholeRange) {
    const dates = sleepQualityRecordsByActivity(records, summary.group, throughDate).map(record => record.date);
    assert.deepEqual(dates, expected[summary.group]);
    assert.equal(dates.length, summary.ratedDays);
  }

  const aprilRecords = records.filter(record => record.date.startsWith('2026-04'));
  for (const summary of summarizeSleepQualityByActivity(aprilRecords, throughDate)) {
    assert.deepEqual(
      sleepQualityRecordsByActivity(aprilRecords, summary.group, throughDate).map(record => record.date),
      expected[summary.group].filter(date => date.startsWith('2026-04')),
    );
  }
});

test('sleep quality month details show saved records only, keep unrated records, and sort by date', () => {
  const records = [
    { date: '2026-04-03', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: 'Rested', naps: [], wakeUps: [] } },
    { date: '2026-04-01', sleep: { bedtime: null, wakeTime: null, quality: 0, note: 'No rating', naps: [], wakeUps: [] } },
    { date: '2026-04-02', sleep: undefined },
    { date: '2026-03-31', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 3, note: '', naps: [], wakeUps: [] } },
    { date: '2026-04-30', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 4, note: 'Future', naps: [], wakeUps: [] } },
  ];

  const details = sleepQualityRecordsForMonth(records, '2026-04', '2026-04-29');
  assert.deepEqual(details.map(record => record.date), ['2026-04-01', '2026-04-03']);
  assert.equal(details[0].sleep.note, 'No rating');
  assert.equal(isValidSleepQuality(details[0].sleep.quality), false);
  assert.equal(isValidSleepQuality(details[1].sleep.quality), true);
  assert.deepEqual(sleepQualityRecordsForMonth(records, '2026-13', '2026-12-31'), []);
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
  assert.deepEqual(summary[3].qualityCounts, [0, 0, 0, 0, 0]);
  assert.deepEqual(summary[5].qualityCounts, [0, 0, 0, 0, 0]);
  assert.equal(summary[6].averageQuality, null);
});

test('weekday sleep duration averages include valid overnight and nap-only logs only', () => {
  const summary = summarizeSleepDurationByWeekday([
    { date: '2026-10-05', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 5, note: '', naps: [], wakeUps: [] }, minutes: 480 },
    { date: '2026-10-12', sleep: { bedtime: null, wakeTime: null, quality: 0, note: '', naps: [{ startTime: '13:00', endTime: '14:00' }] }, minutes: 60 },
    { date: '2026-10-06', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 2, note: '', naps: [], wakeUps: [] }, minutes: null },
    { date: '2026-10-13', sleep: { bedtime: null, wakeTime: null, quality: 0, note: '', naps: [{ startTime: '13:00', endTime: '14:00' }] }, minutes: 0 },
    { date: '2026-10-14', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 0, note: '', naps: [], wakeUps: [] }, minutes: Number.NaN },
    { date: '2026-10-15', sleep: undefined, minutes: 120 },
    { date: '2026-10-16', sleep: { bedtime: '22:00', wakeTime: '06:00', quality: 0, note: '', naps: [], wakeUps: [] }, minutes: 600 },
  ], '2026-10-15');
  assert.equal(summary.length, 7);
  assert.equal(summary[1].durationCount, 2);
  assert.equal(summary[1].averageMinutes, 270);
  assert.equal(summary[2].averageMinutes, null);
  assert.equal(summary[2].durationCount, 0);
  assert.equal(summary[3].durationCount, 0);
  assert.equal(summary[4].durationCount, 0);
  assert.equal(summary[5].durationCount, 0);
  assert.equal(summary[6].durationCount, 0);
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

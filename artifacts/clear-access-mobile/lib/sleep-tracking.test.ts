// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by the direct regression suite.
import test from 'node:test';
import { calculateTotalSleepMinutes, formatSleepDuration, sleepDurationMinutes, sleepReferenceForDate, sleepWeekDates } from './sleep-tracking';

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

test('sleep weeks are Monday to Sunday across month and year boundaries', () => {
  assert.deepEqual(sleepWeekDates('2026-10-10'), [
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
  ]);
  assert.deepEqual(sleepWeekDates('2027-01-01'), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ]);
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

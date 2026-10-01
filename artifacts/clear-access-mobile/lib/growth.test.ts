// @ts-ignore Node's built-in test modules are used only by this pure-math regression suite.
import assert from 'node:assert/strict';
// @ts-ignore Node's built-in test modules are used only by this pure-math regression suite.
import test from 'node:test';
import {
  ageInCalendarMonths,
  assessCdcEligibility,
  cdcPercentile,
  CDC_STATURE_ROWS,
  getCdcHeightDomain,
  getHistoryPlot,
  interpolateCdcRow,
  isValidGrowthDate,
  mapHistoryRecords,
} from './growth';
import type { HeightRecord } from './local-models';

const record = (id: number, date: string, heightCm = 100): HeightRecord => ({
  id, personId: 1, date, heightCm,
});

test('bundled CDC source contains the official 24–240 month LMS and P5/P50/P95 rows', () => {
  assert.equal(CDC_STATURE_ROWS.length, 436);
  assert.equal(CDC_STATURE_ROWS.filter(row => row.sex === 'male').length, 218);
  assert.equal(CDC_STATURE_ROWS.filter(row => row.sex === 'female').length, 218);
  for (const sex of ['male', 'female'] as const) {
    const rows = CDC_STATURE_ROWS.filter(row => row.sex === sex);
    assert.equal(rows[0].ageMonths, 24);
    assert.equal(rows.at(-1)?.ageMonths, 240);
    assert.ok(rows.every(row => [row.L, row.M, row.S, row.p5, row.p50, row.p95].every(Number.isFinite)));
  }
});

test('CDC median LMS heights map to approximately the 50th percentile for each reference sex', () => {
  const boy = interpolateCdcRow(120.5, 'male')!;
  const girl = interpolateCdcRow(120.5, 'female')!;
  assert.ok(Math.abs(cdcPercentile(boy.M, boy)! - 50) < 0.01);
  assert.ok(Math.abs(cdcPercentile(girl.M, girl)! - 50) < 0.01);
  assert.notEqual(boy.M, girl.M);
});

test('fractional age months interpolate official CDC LMS and percentile values', () => {
  const rows = CDC_STATURE_ROWS.filter(row => row.sex === 'male');
  const lower = rows.find(row => row.ageMonths === 24)!;
  const upper = rows.find(row => row.ageMonths === 24.5)!;
  const actual = interpolateCdcRow(24.25, 'male')!;
  assert.equal(actual.M, (lower.M + upper.M) / 2);
  assert.equal(actual.p5, (lower.p5 + upper.p5) / 2);
  assert.equal(actual.p50, (lower.p50 + upper.p50) / 2);
  assert.equal(actual.p95, (lower.p95 + upper.p95) / 2);
});

test('CDC comparisons include exact 2–20 year boundaries and exclude outside ages', () => {
  assert.ok(interpolateCdcRow(24, 'female'));
  assert.ok(interpolateCdcRow(240, 'female'));
  assert.equal(interpolateCdcRow(23.999, 'female'), null);
  assert.equal(interpolateCdcRow(240.001, 'female'), null);
  assert.equal(assessCdcEligibility(record(1, '2002-01-01'), '2000-01-01', 'male', '2024-01-01').eligible, true);
  assert.equal(assessCdcEligibility(record(2, '2020-01-01'), '2000-01-01', 'female', '2024-01-01').eligible, true);
  assert.deepEqual(
    assessCdcEligibility(record(3, '2001-12-31'), '2000-01-01', 'male', '2024-01-01'),
    { eligible: false, reason: 'before-age-two' },
  );
  assert.deepEqual(
    assessCdcEligibility(record(4, '2020-01-02'), '2000-01-01', 'female', '2024-01-01'),
    { eligible: false, reason: 'after-age-twenty' },
  );
});

test('growth dates reject impossible dates and ages reject invalid or post-measurement DOBs', () => {
  assert.equal(isValidGrowthDate('2024-02-29'), true);
  assert.equal(isValidGrowthDate('2023-02-29'), false);
  assert.equal(isValidGrowthDate('2024-13-01'), false);
  assert.equal(ageInCalendarMonths('not-a-date', '2024-01-01'), null);
  assert.equal(ageInCalendarMonths('2024-02-30', '2024-03-01'), null);
  assert.equal(ageInCalendarMonths('2024-03-02', '2024-03-01'), null);
  assert.deepEqual(
    assessCdcEligibility(record(1, '2024-03-01'), '2024-03-02', 'female', '2024-03-03'),
    { eligible: false, reason: 'before-date-of-birth' },
  );
});

test('calendar-month age handles leap-day birthdays using clamped UTC anniversaries', () => {
  assert.equal(ageInCalendarMonths('2020-02-29', '2021-02-28'), 12);
  assert.equal(ageInCalendarMonths('2020-02-29', '2021-03-01'), 12 + 1 / 29);
});

test('history mapping retains all records in date-proportional chronological order', () => {
  const input = [
    record(3, '2023-07-01', 120),
    record(1, '2023-01-01', 110),
    record(2, '2023-04-02', 115),
  ];
  const points = mapHistoryRecords(input);
  assert.deepEqual(points.map(point => point.id), [1, 2, 3]);
  assert.deepEqual(points.map(point => point.xFraction), [0, 91 / 181, 1]);
  assert.equal(points.length, input.length);
});

test('a single history record remains visible at the center of the chart', () => {
  const plot = getHistoryPlot([record(7, '2024-03-05', 142.4)]);
  assert.equal(plot.points.length, 1);
  assert.equal(plot.points[0].xFraction, 0.5);
  assert.equal(plot.points[0].yFraction, 0.5);
  assert.equal(plot.points[0].heightCm, 142.4);
});

test('history points and tick labels share the same padded height domain', () => {
  const plot = getHistoryPlot([
    record(1, '2023-01-01', 100),
    record(2, '2024-01-01', 200),
  ]);
  assert.deepEqual(plot.heightDomain, { min: 92, max: 208 });
  const span = plot.heightDomain.max - plot.heightDomain.min;
  const recoveredHeights = plot.points.map(point =>
    plot.heightDomain.max - point.yFraction * span,
  );
  assert.ok(Math.abs(recoveredHeights[0] - 100) < 1e-10);
  assert.ok(Math.abs(recoveredHeights[1] - 200) < 1e-10);
});

test('CDC chart domain keeps eligible 20 cm and 220 cm measurements visible, not excluded outliers', () => {
  const measurements = [
    record(1, '2002-01-01', 20),
    record(2, '2020-01-01', 220),
    record(3, '2001-01-01', 500),
  ];
  const domain = getCdcHeightDomain('male', measurements, '2000-01-01', '2024-01-01');
  assert.ok(domain.min < 20);
  assert.ok(domain.max > 220);
  assert.ok(domain.max < 500);
  for (const height of [20, 220]) {
    const normalizedY = (domain.max - height) / (domain.max - domain.min);
    assert.ok(normalizedY >= 0 && normalizedY <= 1);
  }
});
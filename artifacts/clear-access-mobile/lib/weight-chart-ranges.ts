import type { WeightRecord } from './local-models';

export const WEIGHT_CHART_RANGES = [
  { id: '4-weeks', label: '4 weeks', accessibilityLabel: 'Last 4 weeks' },
  { id: '3-months', label: '3 months', accessibilityLabel: 'Last 3 months' },
  { id: '6-months', label: '6 months', accessibilityLabel: 'Last 6 months' },
  { id: 'all', label: 'All', accessibilityLabel: 'All history' },
] as const;

export type WeightChartRange = typeof WEIGHT_CHART_RANGES[number]['id'];

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractMonths(date: Date, months: number): Date {
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDay),
  ));
}

export function weightChartRangeStart(range: WeightChartRange, currentDate: string): string | null {
  if (range === 'all') return null;
  const date = new Date(`${currentDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== currentDate) return null;
  if (range === '4-weeks') return dateString(new Date(date.getTime() - 27 * 24 * 60 * 60 * 1000));
  return dateString(subtractMonths(date, range === '3-months' ? 3 : 6));
}

export function filterWeightRecordsByRange(
  records: WeightRecord[],
  range: WeightChartRange,
  currentDate: string,
): WeightRecord[] {
  const startDate = weightChartRangeStart(range, currentDate);
  return range === 'all' || startDate === null
    ? [...records]
    : records.filter(record => record.date >= startDate && record.date <= currentDate);
}

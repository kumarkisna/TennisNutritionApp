import CDC_DATA from '@/assets/cdc-stature-for-age.json';
import type { HeightRecord } from '@/lib/local-api';

export type GrowthReferenceSex = 'male' | 'female';
export type CdcStatureRow = {
  sex: GrowthReferenceSex;
  ageMonths: number;
  L: number;
  M: number;
  S: number;
  p5: number;
  p50: number;
  p95: number;
};
export type HistoryPoint = HeightRecord & { xFraction: number; yFraction: number };
export type HistoryPlot = {
  points: HistoryPoint[];
  minHeight: number;
  maxHeight: number;
  heightDomain: { min: number; max: number };
  firstDate: string | null;
  lastDate: string | null;
};

export const CDC_STATURE_ROWS = CDC_DATA as CdcStatureRow[];
export const CDC_SOURCE_URL = 'https://www.cdc.gov/growthcharts/data/zscore/statage.csv';
export const CDC_SOURCE_INFO_URL = 'https://www.cdc.gov/growthcharts/cdc-data-files.htm';
export const CDC_MIN_AGE_MONTHS = 24;
export const CDC_MAX_AGE_MONTHS = 240;

function leapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return leapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidGrowthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function epochDay(value: string): number | null {
  if (!isValidGrowthDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / 86_400_000;
}

function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const monthIndex = year * 12 + month - 1 + months;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - nextYear * 12 + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

/** Fractional calendar months, based on UTC calendar anniversaries rather than 30-day approximations. */
export function ageInCalendarMonths(dateOfBirth: string, observationDate: string): number | null {
  const birthDay = epochDay(dateOfBirth);
  const observationDay = epochDay(observationDate);
  if (birthDay === null || observationDay === null || observationDay < birthDay) return null;
  const [by, bm] = dateOfBirth.split('-').map(Number);
  const [oy, om] = observationDate.split('-').map(Number);
  let wholeMonths = (oy - by) * 12 + om - bm;
  let anniversary = addCalendarMonths(dateOfBirth, wholeMonths);
  if (anniversary > observationDate) {
    wholeMonths -= 1;
    anniversary = addCalendarMonths(dateOfBirth, wholeMonths);
  }
  const nextAnniversary = addCalendarMonths(dateOfBirth, wholeMonths + 1);
  const startDay = epochDay(anniversary)!;
  const nextDay = epochDay(nextAnniversary)!;
  return wholeMonths + (observationDay - startDay) / (nextDay - startDay);
}

/** Interpolate CDC LMS and published percentile values between adjacent monthly source rows. */
export function interpolateCdcRow(ageMonths: number, sex: GrowthReferenceSex): CdcStatureRow | null {
  if (!Number.isFinite(ageMonths) || ageMonths < CDC_MIN_AGE_MONTHS || ageMonths > CDC_MAX_AGE_MONTHS) return null;
  const rows = CDC_STATURE_ROWS.filter(row => row.sex === sex);
  if (!rows.length) return null;
  let upperIndex = rows.findIndex(row => row.ageMonths >= ageMonths);
  if (upperIndex < 0) return null;
  if (rows[upperIndex].ageMonths === ageMonths || upperIndex === 0) return rows[upperIndex];
  const lower = rows[upperIndex - 1];
  const upper = rows[upperIndex];
  const ratio = (ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
  const interpolate = (key: 'L' | 'M' | 'S' | 'p5' | 'p50' | 'p95') =>
    lower[key] + (upper[key] - lower[key]) * ratio;
  return {
    sex,
    ageMonths,
    L: interpolate('L'),
    M: interpolate('M'),
    S: interpolate('S'),
    p5: interpolate('p5'),
    p50: interpolate('p50'),
    p95: interpolate('p95'),
  };
}

function normalCdf(z: number): number {
  if (z === 0) return 0.5;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
    0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

export function cdcPercentile(heightCm: number, row: Pick<CdcStatureRow, 'L' | 'M' | 'S'>): number | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0 || !Number.isFinite(row.M) || row.M <= 0 || row.S <= 0) return null;
  const z = row.L === 0
    ? Math.log(heightCm / row.M) / row.S
    : (Math.pow(heightCm / row.M, row.L) - 1) / (row.L * row.S);
  if (!Number.isFinite(z)) return null;
  return normalCdf(z) * 100;
}

export type CdcExclusionReason =
  | 'missing-date-of-birth'
  | 'missing-reference-sex'
  | 'invalid-date-of-birth'
  | 'invalid-measurement-date'
  | 'before-date-of-birth'
  | 'before-age-two'
  | 'after-age-twenty'
  | 'future-measurement';

export type CdcEligibility =
  | { eligible: true; ageMonths: number; ageYears: number; percentile: number | null }
  | { eligible: false; reason: CdcExclusionReason };

export function assessCdcEligibility(
  record: Pick<HeightRecord, 'date' | 'heightCm'>,
  dateOfBirth: string | null,
  sex: GrowthReferenceSex | null,
  today: string,
): CdcEligibility {
  if (!dateOfBirth) return { eligible: false, reason: 'missing-date-of-birth' };
  if (!sex) return { eligible: false, reason: 'missing-reference-sex' };
  if (!isValidGrowthDate(dateOfBirth)) return { eligible: false, reason: 'invalid-date-of-birth' };
  if (!isValidGrowthDate(record.date)) return { eligible: false, reason: 'invalid-measurement-date' };
  if (record.date < dateOfBirth) return { eligible: false, reason: 'before-date-of-birth' };
  if (record.date > today) return { eligible: false, reason: 'future-measurement' };
  const ageMonths = ageInCalendarMonths(dateOfBirth, record.date);
  if (ageMonths === null) return { eligible: false, reason: 'invalid-measurement-date' };
  if (ageMonths < CDC_MIN_AGE_MONTHS) return { eligible: false, reason: 'before-age-two' };
  if (ageMonths > CDC_MAX_AGE_MONTHS) return { eligible: false, reason: 'after-age-twenty' };
  const lms = interpolateCdcRow(ageMonths, sex);
  if (!lms) return { eligible: false, reason: 'after-age-twenty' };
  return {
    eligible: true,
    ageMonths,
    ageYears: ageMonths / 12,
    percentile: cdcPercentile(record.heightCm, lms),
  };
}

/** A padded chart range shared by history coordinates and their displayed axis ticks. */
export function getHistoryHeightDomain(records: HeightRecord[]): { min: number; max: number } {
  if (!records.length) return { min: -1, max: 1 };
  const heights = records.map(record => record.heightCm);
  const minimum = Math.min(...heights);
  const maximum = Math.max(...heights);
  const padding = Math.max(1, (maximum - minimum) * 0.08);
  return { min: minimum - padding, max: maximum + padding };
}

/** Include eligible observations and official CDC P5/P95 values without plotting excluded records. */
export function getCdcHeightDomain(
  sex: GrowthReferenceSex,
  records: HeightRecord[],
  dateOfBirth: string | null,
  today: string,
): { min: number; max: number } {
  const referenceRows = CDC_STATURE_ROWS.filter(row => row.sex === sex);
  const eligibleHeights = records
    .filter(record => assessCdcEligibility(record, dateOfBirth, sex, today).eligible)
    .map(record => record.heightCm);
  const minimum = Math.min(...referenceRows.map(row => row.p5), ...eligibleHeights);
  const maximum = Math.max(...referenceRows.map(row => row.p95), ...eligibleHeights);
  return {
    min: Math.floor((minimum - 2) / 5) * 5,
    max: Math.ceil((maximum + 2) / 5) * 5,
  };
}

/** Keep every local record in chronological order for the all-height-history chart. */
export function mapHistoryRecords(
  records: HeightRecord[],
  heightDomain = getHistoryHeightDomain(records),
): HistoryPoint[] {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const validDays = sorted.map(record => epochDay(record.date)).filter((day): day is number => day !== null);
  const minDay = validDays.length ? Math.min(...validDays) : 0;
  const maxDay = validDays.length ? Math.max(...validDays) : minDay;
  const heights = sorted.map(record => record.heightCm);
  const minHeight = heights.length ? Math.min(...heights) : 0;
  const maxHeight = heights.length ? Math.max(...heights) : minHeight;
  const daySpan = maxDay - minDay;
  const heightSpan = maxHeight - minHeight;
  return sorted.map(record => {
    const day = epochDay(record.date);
    return {
      ...record,
      xFraction: sorted.length === 1 || daySpan === 0 || day === null ? 0.5 : (day - minDay) / daySpan,
      yFraction: sorted.length === 1 || heightSpan === 0
        ? 0.5
        : 1 - (record.heightCm - heightDomain.min) / (heightDomain.max - heightDomain.min),
    };
  });
}

export function getHistoryPlot(records: HeightRecord[]): HistoryPlot {
  const heightDomain = getHistoryHeightDomain(records);
  const points = mapHistoryRecords(records, heightDomain);
  const heights = points.map(point => point.heightCm);
  return {
    points,
    minHeight: heights.length ? Math.min(...heights) : 0,
    maxHeight: heights.length ? Math.max(...heights) : 0,
    heightDomain,
    firstDate: points[0]?.date ?? null,
    lastDate: points[points.length - 1]?.date ?? null,
  };
}

export const CDC_EXCLUSION_LABELS: Record<CdcExclusionReason, string> = {
  'missing-date-of-birth': 'Date of birth is not set',
  'missing-reference-sex': 'CDC reference sex is not selected',
  'invalid-date-of-birth': 'Date of birth is invalid',
  'invalid-measurement-date': 'Measurement date is invalid',
  'before-date-of-birth': 'Measurement is before date of birth',
  'before-age-two': 'CDC stature chart starts at age 2',
  'after-age-twenty': 'CDC stature chart ends at age 20',
  'future-measurement': 'Measurement date is in the future',
};
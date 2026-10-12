import { isClockTime } from './tennis-planning';
import { ageInCalendarMonths } from './growth';
import type { SleepInterval, SleepLog } from './local-models';

export type SleepReference = { label: string; minMinutes: number; maxMinutes: number | null; includesNaps: boolean };
export type SleepTimes = { bedtime: string; wakeTime: string };

export function reusableSleepTimes(sleep: Pick<SleepLog, 'bedtime' | 'wakeTime'> | null | undefined): SleepTimes | null {
  if (!sleep || !isClockTime(sleep.bedtime) || !isClockTime(sleep.wakeTime)) return null;
  return { bedtime: sleep.bedtime, wakeTime: sleep.wakeTime };
}

export function sleepWeekDates(anchorDate: string): string[] {
  const [year, month, day] = anchorDate.split('-').map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}

export function sleepMonthDates(anchorDate: string): string[] {
  const [year, month] = anchorDate.slice(0, 7).split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) =>
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
}

export function sleepMonthWeekRanges(month: string) {
  const weeks = new Map<string, string[]>();
  for (const date of sleepMonthDates(`${month}-01`)) {
    const monday = sleepWeekDates(date)[0];
    weeks.set(monday, [...(weeks.get(monday) ?? []), date]);
  }
  return [...weeks.values()].map(dates => ({
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    dates,
    partial: dates.length < 7,
  }));
}

export function shiftSleepMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

export type SleepPeriodRecord = {
  date: string;
  sleep: SleepLog | undefined;
  minutes: number | null;
};

export function summarizeSleepRecords(records: readonly SleepPeriodRecord[], throughDate: string) {
  const elapsed = records.filter(record => record.date <= throughDate);
  const logged = elapsed.filter(record => record.sleep !== undefined);
  const measured = logged.filter(record => record.minutes !== null);
  const qualityCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const rated = logged.filter(record => {
    const quality = record.sleep!.quality;
    if (!Number.isInteger(quality) || quality < 1 || quality > 5) return false;
    qualityCounts[quality - 1] += 1;
    return true;
  });
  const napOnly = logged.filter(record => record.sleep!.bedtime === null && record.sleep!.wakeTime === null &&
    (record.sleep!.naps?.length ?? 0) > 0);
  const overnight = logged.filter(record => record.sleep!.bedtime !== null && record.sleep!.wakeTime !== null);
  return {
    elapsedDays: elapsed.length,
    loggedDays: logged.length,
    missingDays: elapsed.length - logged.length,
    napOnlyDays: napOnly.length,
    overnightDays: overnight.length,
    averageMinutes: measured.length ? Math.round(measured.reduce((sum, record) => sum + record.minutes!, 0) / measured.length) : null,
    ratedDays: rated.length,
    qualityCounts,
    averageQuality: rated.length ? rated.reduce((sum, record) => sum + record.sleep!.quality, 0) / rated.length : null,
  };
}

export function sleepReferenceForDate(dateOfBirth: string | null, date: string): SleepReference | null {
  if (!dateOfBirth) return null;
  const months = ageInCalendarMonths(dateOfBirth, date);
  if (months === null) return null;
  if (months < 4) return { label: '14–17 h', minMinutes: 14 * 60, maxMinutes: 17 * 60, includesNaps: false };
  if (months < 12) return { label: '12–16 h', minMinutes: 12 * 60, maxMinutes: 16 * 60, includesNaps: true };
  if (months < 36) return { label: '11–14 h', minMinutes: 11 * 60, maxMinutes: 14 * 60, includesNaps: true };
  if (months < 72) return { label: '10–13 h', minMinutes: 10 * 60, maxMinutes: 13 * 60, includesNaps: true };
  if (months < 156) return { label: '9–12 h', minMinutes: 9 * 60, maxMinutes: 12 * 60, includesNaps: false };
  if (months < 216) return { label: '8–10 h', minMinutes: 8 * 60, maxMinutes: 10 * 60, includesNaps: false };
  const ageYears = Math.floor(months / 12);
  if (ageYears <= 60) return { label: '7+ h', minMinutes: 7 * 60, maxMinutes: null, includesNaps: false };
  if (ageYears <= 64) return { label: '7–9 h', minMinutes: 7 * 60, maxMinutes: 9 * 60, includesNaps: false };
  return { label: '7–8 h', minMinutes: 7 * 60, maxMinutes: 8 * 60, includesNaps: false };
}

export function sleepDurationMinutes(bedtime: string | null, wakeTime: string | null): number | null {
  if (typeof bedtime !== 'string' || typeof wakeTime !== 'string' || !isClockTime(bedtime) || !isClockTime(wakeTime) || bedtime === wakeTime) return null;
  const bedtimeMinutes = Number(bedtime.slice(0, 2)) * 60 + Number(bedtime.slice(3));
  const wakeMinutes = Number(wakeTime.slice(0, 2)) * 60 + Number(wakeTime.slice(3));
  return (wakeMinutes - bedtimeMinutes + 1440) % 1440;
}

function minuteOfDay(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

export function intervalDurationMinutes(interval: SleepInterval): number | null {
  if (!isClockTime(interval.startTime) || !isClockTime(interval.endTime) || interval.startTime === interval.endTime) return null;
  return (minuteOfDay(interval.endTime) - minuteOfDay(interval.startTime) + 1440) % 1440;
}

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1]) merged.push([start, end]);
    else last[1] = Math.max(last[1], end);
  }
  return merged;
}

function intervalTotal(intervals: [number, number][]): number {
  return intervals.reduce((sum, [start, end]) => sum + end - start, 0);
}

export function calculateTotalSleepMinutes(sleep: Pick<SleepLog, 'bedtime' | 'wakeTime'> & Partial<Pick<SleepLog, 'naps' | 'wakeUps'>>): number | null {
  const wakeUps = sleep.wakeUps ?? [];
  const naps = sleep.naps ?? [];
  if (!Array.isArray(wakeUps) || !Array.isArray(naps)) return null;
  const nightMinutes = sleepDurationMinutes(sleep.bedtime, sleep.wakeTime);
  if (nightMinutes === null) {
    if (wakeUps.length > 0) return null;
    const napRanges: [number, number][] = [];
    for (const nap of naps) {
      const duration = intervalDurationMinutes(nap);
      if (duration === null) return null;
      const start = minuteOfDay(nap.startTime);
      napRanges.push([start, start + duration]);
    }
    const napTotal = intervalTotal(mergeIntervals(napRanges));
    return napTotal > 0 && napTotal <= 1440 ? napTotal : null;
  }
  if (sleep.bedtime === null || sleep.wakeTime === null) return null;
  const bedMinute = minuteOfDay(sleep.bedtime);
  const nightEnd = bedMinute + nightMinutes;

  const awakeRanges: [number, number][] = [];
  for (const wakeUp of wakeUps) {
    const duration = intervalDurationMinutes(wakeUp);
    if (duration === null) return null;
    const offset = (minuteOfDay(wakeUp.startTime) - bedMinute + 1440) % 1440;
    const start = bedMinute + offset;
    const end = start + duration;
    if (start < bedMinute || start >= nightEnd || end > nightEnd) return null;
    awakeRanges.push([start, end]);
  }
  const mergedAwake = mergeIntervals(awakeRanges);
  const awakeMinutes = intervalTotal(mergedAwake);
  const overnightRanges: [number, number][] = [];
  let cursor = bedMinute;
  for (const [start, end] of mergedAwake) {
    if (start > cursor) overnightRanges.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < nightEnd) overnightRanges.push([cursor, nightEnd]);

  // The planner date is the morning/wake date, so naps shift one day forward
  // on a night that crossed midnight.
  const dayOffset = minuteOfDay(sleep.wakeTime) <= bedMinute ? 1440 : 0;
  const napRanges: [number, number][] = [];
  for (const nap of naps) {
    const duration = intervalDurationMinutes(nap);
    if (duration === null) return null;
    const start = dayOffset + minuteOfDay(nap.startTime);
    napRanges.push([start, start + duration]);
  }
  const allSleepRanges = mergeIntervals([...overnightRanges, ...napRanges]);
  const total = intervalTotal(allSleepRanges);
  return Number.isFinite(awakeMinutes) && total > 0 && total <= 1440 ? total : null;
}

export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

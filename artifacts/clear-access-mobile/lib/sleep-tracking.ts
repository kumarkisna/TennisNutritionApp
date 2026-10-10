import { isClockTime } from './tennis-planning';
import { ageInCalendarMonths } from './growth';

export type SleepReference = { label: string; minMinutes: number; maxMinutes: number | null; includesNaps: boolean };

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

export function sleepDurationMinutes(bedtime: string, wakeTime: string): number | null {
  if (!isClockTime(bedtime) || !isClockTime(wakeTime) || bedtime === wakeTime) return null;
  const bedtimeMinutes = Number(bedtime.slice(0, 2)) * 60 + Number(bedtime.slice(3));
  const wakeMinutes = Number(wakeTime.slice(0, 2)) * 60 + Number(wakeTime.slice(3));
  return (wakeMinutes - bedtimeMinutes + 1440) % 1440;
}

export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

import { isClockTime } from './tennis-planning';

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

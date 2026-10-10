import { getAgeOnDate } from './planning-targets';
import type { HydrationEntry, HydrationLog, HydrationSession } from './local-models';

export const HYDRATION_REMINDER_PREFIX = 'clear-access-hydration:';
export const MAX_HYDRATION_ENTRIES = 20;
export const MAX_HYDRATION_SESSIONS = 10;

export function estimateSessionSweatRate(session: Pick<HydrationSession, 'durationMinutes' | 'preWeightKg' | 'postWeightKg' | 'fluidMl' | 'urineMl'>) {
  if (session.durationMinutes <= 0) return null;
  const liters = session.preWeightKg - session.postWeightKg + (session.fluidMl - session.urineMl) / 1000;
  return liters / (session.durationMinutes / 60);
}

export function hydrationReference(dateOfBirth: string | null, sex: 'male' | 'female' | null, date: string) {
  if (!dateOfBirth) return null;
  const age = getAgeOnDate(dateOfBirth, date);
  if (age === null || age < 1) return null;
  const values: [number, number, number, number] | null =
    age <= 3 ? [1.3, 0.9, 1.3, 0.9] :
    age <= 8 ? [1.7, 1.2, 1.7, 1.2] :
    age <= 13 ? [2.1, 1.6, 2.4, 1.8] :
    age <= 18 ? [2.3, 1.8, 3.3, 2.6] :
    age <= 50 ? [2.7, 2.2, 3.7, 3.0] :
    age <= 70 ? [2.7, 2.2, 3.7, 3.0] : [2.7, 2.2, 3.7, 3.0];
  const [femaleTotal, femaleDrink, maleTotal, maleDrink] = values;
  return sex === 'female'
    ? { age, totalLiters: [femaleTotal, femaleTotal] as [number, number], beverageLiters: [femaleDrink, femaleDrink] as [number, number] }
    : sex === 'male'
      ? { age, totalLiters: [maleTotal, maleTotal] as [number, number], beverageLiters: [maleDrink, maleDrink] as [number, number] }
      : { age, totalLiters: [femaleTotal, maleTotal] as [number, number], beverageLiters: [femaleDrink, maleDrink] as [number, number] };
}

export function hydrationTotals(log?: HydrationLog) {
  return (log?.entries ?? []).reduce((total, entry) => ({
    plannedMl: total.plannedMl + entry.plannedMl,
    actualMl: total.actualMl + (entry.actualMl ?? 0),
  }), { plannedMl: 0, actualMl: 0 });
}

export function mergeHydrationSchedule(current: HydrationEntry[], source: HydrationEntry[], createId: (index: number) => string) {
  const merged = [...current];
  source.forEach((entry, index) => {
    const existingIndex = merged.findIndex(existing => existing.time === entry.time);
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], plannedMl: entry.plannedMl, alertEnabled: entry.alertEnabled };
    } else {
      merged.push({
        id: createId(index), time: entry.time, plannedMl: entry.plannedMl,
        actualMl: null, alertEnabled: entry.alertEnabled,
      });
    }
  });
  return merged;
}
